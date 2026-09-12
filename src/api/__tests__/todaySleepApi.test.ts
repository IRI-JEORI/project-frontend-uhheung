import AsyncStorage from '@react-native-async-storage/async-storage';
import { nunnunApi } from '../nunnunApi';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const response = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);

const today = {
  date: '2026-08-19',
  targetBedTime: null,
  targetWakeTime: null,
  estimatedReturnTime: null,
  fixedSchedules: [
    {
      id: 1,
      title: '수업',
      dayOfWeek: 'WEDNESDAY',
      startTime: '09:00:00',
      endTime: '10:30:00',
    },
  ],
  resolved_target_wake_time: '07:30',
  next_target_at: '2026-08-20T07:30:00+09:00',
  sleep: {
    status: 'SLEEPING',
    sleep_session_id: 301,
    started_at: '2026-08-19T23:40:00+09:00',
  },
};

describe('Today and Sleep API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('access-token');
  });

  it.each([
    ['updateBedTime', '/me/today/bed-time', 'targetBedTime', '23:30'],
    ['updateReturnTime', '/me/today/return-time', 'estimatedReturnTime', '20:15'],
  ] as const)('sends %s using the backend main DTO field', async (operation, path, field, time) => {
    const saved = { [field]: `${time}:00` };
    globalThis.fetch = jest.fn(() =>
      response({ success: true, data: saved }),
    ) as jest.Mock;

    await expect(nunnunApi.me[operation](time)).resolves.toEqual(saved);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ [field]: time }),
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('gets and parses the mixed-case Today contract', async () => {
    globalThis.fetch = jest.fn(() =>
      response({ success: true, data: today }),
    ) as jest.Mock;

    await expect(nunnunApi.me.getToday()).resolves.toEqual(today);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/me\/today$/),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('parses awake, no target, and empty schedules as normal state', async () => {
    const awake = {
      ...today,
      fixedSchedules: [],
      resolved_target_wake_time: null,
      next_target_at: null,
      sleep: {
        status: 'AWAKE',
        sleep_session_id: null,
        started_at: null,
      },
    };
    globalThis.fetch = jest.fn(() =>
      response({ success: true, data: awake }),
    ) as jest.Mock;

    await expect(nunnunApi.me.getToday()).resolves.toEqual(awake);
  });

  it('starts sleep with APP source and parses the 201 response', async () => {
    const created = {
      sleep_session_id: 301,
      started_at: '2026-08-19T23:40:00+09:00',
      bedtime_reminders_cancelled: true,
    };
    globalThis.fetch = jest.fn(() =>
      response({ success: true, data: created }, 201),
    ) as jest.Mock;

    await expect(nunnunApi.me.sleep()).resolves.toEqual(created);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/me\/sleep$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'APP' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it.each([
    ['getToday', 401, 'UNAUTHORIZED'],
    ['getToday', 404, 'USER_NOT_FOUND'],
    ['sleep', 409, 'ALREADY_SLEEPING'],
  ] as const)('surfaces %s %i %s without token reissue', async (operation, status, code) => {
    globalThis.fetch = jest.fn(() =>
      response({ success: false, error: { code, message: 'today error' } }, status),
    ) as jest.Mock;

    const request = operation === 'getToday'
      ? nunnunApi.me.getToday()
      : nunnunApi.me.sleep();
    await expect(request).rejects.toMatchObject({ status, code });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/reissue$/),
      expect.anything(),
    );
  });

  it('reissues and retries the sleep mutation once for EXPIRED_JWT', async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce('expired-access')
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce('new-access');
    const created = {
      sleep_session_id: 301,
      started_at: '2026-08-19T23:40:00+09:00',
      bedtime_reminders_cancelled: true,
    };
    globalThis.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        response(
          {
            success: false,
            error: { code: 'EXPIRED_JWT', message: 'Expired token.' },
          },
          401,
        ),
      )
      .mockImplementationOnce(() =>
        response({
          success: true,
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
          },
        }),
      )
      .mockImplementationOnce(() => response({ success: true, data: created }, 201)) as jest.Mock;

    await expect(nunnunApi.me.sleep()).resolves.toEqual(created);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((fetch as jest.Mock).mock.calls[1][0]).toMatch(/\/auth\/reissue$/);
    expect((fetch as jest.Mock).mock.calls[2][1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'APP' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer new-access',
        }),
      }),
    );
  });
});
