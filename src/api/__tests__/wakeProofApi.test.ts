import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createImageFormData } from '../client';
import { nunnunApi } from '../nunnunApi';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

class TestFormData {
  private parts: Array<Record<string, unknown>> = [];

  append(fieldName: string, value: Record<string, unknown>) {
    this.parts.push({ fieldName, ...value });
  }

  getParts() {
    return this.parts;
  }
}

const response = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);

describe('wake proof API', () => {
  it.each(['png', 'webp', 'jpg'])( 'uses Android image metadata for %s', format => {
    const previousOS = Platform.OS;
    try {
      Platform.OS = 'android';
      const body = createImageFormData(`/cache/photo.${format}`);
      expect((body as unknown as TestFormData).getParts()).toEqual([
        expect.objectContaining({
          fieldName: 'image',
          uri: `file:///cache/photo.${format}`,
          type: format === 'jpg' ? 'image/jpeg' : `image/${format}`,
          name: expect.stringMatching(new RegExp(`\\.${format}$`)),
        }),
      ]);
    } finally {
      Platform.OS = previousOS;
    }
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as unknown as { FormData: typeof FormData }).FormData =
      TestFormData as unknown as typeof FormData;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('access-token');
  });

  it.each([
    ['SUCCESS', true, 0],
    ['FAIL', false, 1],
  ] as const)(
    'uploads image multipart and parses a %s result',
    async (poseMatchResult, success, remainingAttempts) => {
      const proof = {
        wake_request_id: 31,
        attempt_no: 1,
        pose_match_score: success ? 91 : 42,
        pose_match_result: poseMatchResult,
        request_status: success ? 'VERIFIED' : 'SENT',
        can_retry: !success,
        remaining_attempts: remainingAttempts,
        ...(success
          ? {
              verified_at: '2026-08-19T07:35:00+09:00',
              cooldown_until: '2026-08-19T08:05:00+09:00',
              proof_expires_at: '2026-08-19T15:35:00+09:00',
            }
          : {}),
      };
      globalThis.fetch = jest.fn(() =>
        response({ success: true, data: proof }, 201),
      ) as jest.Mock;

      await expect(
        nunnunApi.wake.uploadProof(31, '/cache/photo.jpg'),
      ).resolves.toEqual(proof);

      const [, request] = (fetch as jest.Mock).mock.calls[0];
      expect((request.body as unknown as TestFormData).getParts()).toEqual([
        expect.objectContaining({
          fieldName: 'image',
          uri: 'file:///cache/photo.jpg',
          name: expect.stringMatching(/^nunnun-\d+\.jpg$/),
          type: 'image/jpeg',
        }),
      ]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/wake-requests\/31\/proof$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        }),
      );
      expect(request.headers).not.toHaveProperty('Content-Type');
    },
  );

  it.each([
    [400, 'INVALID_WAKE_PROOF_IMAGE'],
    [401, 'UNAUTHORIZED'],
    [403, 'WAKE_REQUEST_ACCESS_DENIED'],
    [404, 'WAKE_REQUEST_NOT_FOUND'],
    [409, 'RETRY_EXHAUSTED'],
    [409, 'INVALID_WAKE_REQUEST_STATUS'],
    [422, 'POSE_ANALYSIS_FAILED'],
    [502, 'WAKE_PROOF_UPLOAD_FAILED'],
  ])('surfaces %i %s without token reissue', async (status, code) => {
    globalThis.fetch = jest.fn(() =>
      response({ success: false, error: { code, message: 'proof error' } }, status),
    ) as jest.Mock;

    await expect(
      nunnunApi.wake.uploadProof(31, 'content://photo/31'),
    ).rejects.toMatchObject({ status, code, message: 'proof error' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shares a successful proof with selected group ids', async () => {
    const shared = { group_ids: [2, 5] };
    globalThis.fetch = jest.fn(() =>
      response({ success: true, data: shared }),
    ) as jest.Mock;

    await expect(nunnunApi.wake.shareProof(31, [2, 5])).resolves.toEqual(shared);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/wake-requests\/31\/proof\/share$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ group_ids: [2, 5] }),
      }),
    );
  });

  it('loads and acknowledges a pending sender wake success', async () => {
    const pending = {
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    };
    globalThis.fetch = jest
      .fn()
      .mockImplementationOnce(() => response({ success: true, data: pending }))
      .mockImplementationOnce(() => response({ success: true, data: null }));

    await expect(nunnunApi.group.getPendingWakeSuccess(7)).resolves.toEqual(pending);
    await expect(nunnunApi.wake.acknowledgeSuccess(64)).resolves.toBeNull();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/wake-groups\/7\/wake-successes\/pending$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/wake-requests\/64\/success\/ack$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
