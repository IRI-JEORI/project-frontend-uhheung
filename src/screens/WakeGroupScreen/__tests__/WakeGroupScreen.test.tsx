import React from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { nunnunApi } from '../../../api';
import type { WakeGroupDetail } from '../../../api/types';
import WakeGroupScreen from '../index';
import NavHeader from '../../../components/NavHeader';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  popTo: jest.fn(),
};
const mockRoute = { params: { groupId: 7 } };
let appStateChangeHandler: ((state: AppStateStatus) => void) | undefined;
const removeAppStateListener = jest.fn();

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useFocusEffect: (callback: () => void | (() => void)) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../../api', () => ({
  ApiError: class ApiError extends Error {},
  nunnunApi: {
    group: {
      detail: jest.fn(),
      getPendingWakeSuccess: jest.fn(),
      leave: jest.fn(),
      rename: jest.fn(),
    },
    wake: { wakeMember: jest.fn(), acknowledgeSuccess: jest.fn() },
  },
}));

const detail: WakeGroupDetail = {
  id: 7,
  name: '아침 야호',
  invite_code: '8G3FE2',
  capacity: 4,
  current_members: 2,
  members: [
    {
      user_id: 11,
      nickname: '나',
      avatar_url: null,
      is_me: true,
      target_wake_time: '07:30',
      next_target_at: null,
      remaining_to_target: null,
      state: 'NORMAL',
      actual_wake_time: null,
      proof_image_url: null,
      proof_expires_at: null,
      can_wake: false,
      block_reason: null,
      wake_available_at: null,
    },
    {
      user_id: 22,
      nickname: '상대 멤버',
      avatar_url: null,
      is_me: false,
      target_wake_time: '08:00',
      next_target_at: null,
      remaining_to_target: { value: 1, unit: 'HOUR' },
      state: 'NORMAL',
      actual_wake_time: null,
      proof_image_url: null,
      proof_expires_at: null,
      can_wake: true,
      block_reason: null,
      wake_available_at: null,
    },
  ],
};

const screenRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

const renderScreen = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<WakeGroupScreen />);
  });
  screenRenderers.push(renderer);
  return renderer;
};

const buttonWithText = (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) =>
  renderer.root
    .findAllByType(TouchableOpacity)
    .find(button =>
      button.findAllByType(Text).some(text => text.props.children === label),
    );

const press = async (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) => {
  await act(async () => {
    await buttonWithText(renderer, label)?.props.onPress();
  });
};

describe('WakeGroupScreen wake confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateChangeHandler = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
      appStateChangeHandler = handler;
      return { remove: removeAppStateListener };
    });
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    jest.mocked(nunnunApi.group.detail).mockResolvedValue(detail);
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue(null);
    jest.mocked(nunnunApi.group.leave).mockResolvedValue(undefined);
    jest.mocked(nunnunApi.group.rename).mockResolvedValue({ id: 7, name: '새 이름' });
    jest.mocked(nunnunApi.wake.acknowledgeSuccess).mockResolvedValue(undefined);
    jest.mocked(nunnunApi.wake.wakeMember).mockResolvedValue({
      wake_request_id: 31,
      status: 'SENT',
      requested_at: '2026-08-20T09:00:00+09:00',
    });
  });

  afterEach(async () => {
    await act(async () => {
      screenRenderers.splice(0).forEach(renderer => renderer.unmount());
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the real member confirmation without immediately waking', async () => {
    const renderer = await renderScreen();
    await press(renderer, '깨우기');

    const texts = renderer.root.findAllByType(Text).map(node => node.props.children);
    const caution = renderer.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === '주의');

    expect(nunnunApi.wake.wakeMember).not.toHaveBeenCalled();
    expect(texts).toContain('상대 멤버님을 깨울까요?');
    expect(caution).toBeDefined();
  });

  it('cancels without calling the wake API', async () => {
    const renderer = await renderScreen();
    await press(renderer, '깨우기');
    await press(renderer, '안 깨울래요');

    expect(nunnunApi.wake.wakeMember).not.toHaveBeenCalled();
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).not.toContain('상대 멤버님을 깨울까요?');
  });

  it('wakes once, refreshes detail, and closes after success', async () => {
    const renderer = await renderScreen();
    await press(renderer, '깨우기');
    const confirm = buttonWithText(renderer, '깨울게요');

    await act(async () => {
      const first = confirm?.props.onPress();
      const second = confirm?.props.onPress();
      await Promise.all([first, second]);
    });

    expect(nunnunApi.wake.wakeMember).toHaveBeenCalledTimes(1);
    expect(nunnunApi.wake.wakeMember).toHaveBeenCalledWith(7, 22);
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(2);
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).not.toContain('상대 멤버님을 깨울까요?');
  });

  it('keeps the modal after failure and permits a later retry', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.wake.wakeMember).mockRejectedValueOnce(new Error('failed'));
    const renderer = await renderScreen();
    await press(renderer, '깨우기');
    await press(renderer, '깨울게요');

    expect(alert).toHaveBeenCalledWith(
      '깨우기 실패',
      '깨우기 요청을 보내지 못했어요.',
    );
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).toContain('상대 멤버님을 깨울까요?');

    await press(renderer, '깨울게요');
    expect(nunnunApi.wake.wakeMember).toHaveBeenCalledTimes(2);
    alert.mockRestore();
  });

  it('shows a pending success once with the real receiver and clock asset', async () => {
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();

    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).toContain('상대 멤버님 깨우기 성공!');
    expect(
      renderer.root
        .findAllByType(Image)
        .find(node => node.props.accessibilityLabel === '깨우기 성공'),
    ).toBeDefined();
  });

  it('acknowledges Later and closes without navigating', async () => {
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();
    await press(renderer, '나중에');

    expect(nunnunApi.wake.acknowledgeSuccess).toHaveBeenCalledWith(64);
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('RewardList');
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).not.toContain('상대 멤버님 깨우기 성공!');
  });

  it('acknowledges Send and opens RewardList', async () => {
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();
    await press(renderer, '보내기');

    expect(nunnunApi.wake.acknowledgeSuccess).toHaveBeenCalledWith(64);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RewardList');
  });

  it('keeps the success modal after an acknowledgement failure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    jest.mocked(nunnunApi.wake.acknowledgeSuccess).mockRejectedValue(new Error('failed'));
    const renderer = await renderScreen();
    await press(renderer, '나중에');

    expect(alert).toHaveBeenCalledWith(
      '알림 처리 실패',
      '깨우기 성공 알림을 처리하지 못했어요.',
    );
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).toContain('상대 멤버님 깨우기 성공!');
    alert.mockRestore();
  });

  it('does not repoll while the same success is displayed and clears polling on unmount', async () => {
    jest.useFakeTimers();
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();
    expect(nunnunApi.group.getPendingWakeSuccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(12000);
    });
    expect(nunnunApi.group.getPendingWakeSuccess).toHaveBeenCalledTimes(1);

    await act(async () => renderer.unmount());
    screenRenderers.splice(screenRenderers.indexOf(renderer), 1);
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(nunnunApi.group.getPendingWakeSuccess).toHaveBeenCalledTimes(1);
  });

  it('opens the iOS-style custom menu without navigating to group management', async () => {
    const renderer = await renderScreen();

    act(() => renderer.root.findByType(NavHeader).props.onPressRight());

    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    const overlay = renderer.root.find(
      node => node.props.accessibilityLabel === '그룹 메뉴 닫기',
    );
    const panel = renderer.root.find(
      node => StyleSheet.flatten(node.props.style)?.width === 250,
    );

    expect(labels).toEqual(expect.arrayContaining(['방 이름 바꾸기', '방 나가기']));
    expect(labels).not.toContain('취소');
    expect(StyleSheet.flatten(overlay.props.style)).toMatchObject({
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
    });
    expect(StyleSheet.flatten(panel?.props.style)).toMatchObject({
      position: 'absolute',
      right: 28,
      top: 52,
      width: 250,
      height: 105,
      borderRadius: 30,
      paddingVertical: 7,
      backgroundColor: 'rgba(244, 244, 244, 0.88)',
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith(
      'WaitingForMembers',
      expect.anything(),
    );
  });

  it('closes the custom menu when its overlay is pressed', async () => {
    const renderer = await renderScreen();
    act(() => renderer.root.findByType(NavHeader).props.onPressRight());
    const overlay = renderer.root.find(
      node => node.props.accessibilityLabel === '그룹 메뉴 닫기',
    );

    act(() => overlay?.props.onPress());

    expect(renderer.root.findAllByType(Text).map(node => node.props.children)).not.toContain(
      '방 나가기',
    );
  });

  it('cancels leaving without calling the API', async () => {
    const renderer = await renderScreen();
    act(() => renderer.root.findByType(NavHeader).props.onPressRight());
    await press(renderer, '방 나가기');

    expect(
      renderer.root.findAllByType(Image).some(
        node => node.props.accessibilityLabel === '그룹 나가기 경고',
      ),
    ).toBe(true);
    expect(renderer.root.findAllByType(Text).map(node => node.props.children)).toEqual(
      expect.arrayContaining(['방에서 나갈까요?', '아니요', '예']),
    );

    await press(renderer, '아니요');

    expect(nunnunApi.group.leave).not.toHaveBeenCalled();
    expect(mockNavigation.popTo).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(Text).map(node => node.props.children)).not.toContain(
      '방에서 나갈까요?',
    );
  });

  it('leaves once and returns home after confirmation', async () => {
    let resolveLeave!: () => void;
    jest.mocked(nunnunApi.group.leave).mockImplementation(
      () => new Promise<void>(resolve => {
        resolveLeave = resolve;
      }),
    );
    const renderer = await renderScreen();
    act(() => renderer.root.findByType(NavHeader).props.onPressRight());
    await press(renderer, '방 나가기');
    const confirm = buttonWithText(renderer, '예');

    act(() => {
      confirm?.props.onPress();
      confirm?.props.onPress();
    });

    expect(nunnunApi.group.leave).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(
      renderer.root
        .findAllByType(TouchableOpacity)
        .filter(node =>
          ['그룹에 남기', '그룹에서 나가기'].includes(node.props.accessibilityLabel),
        )
        .every(node => node.props.disabled === true),
    ).toBe(true);

    await act(async () => {
      resolveLeave();
      await Promise.resolve();
    });

    expect(nunnunApi.group.leave).toHaveBeenCalledWith(7);
    expect(mockNavigation.popTo).toHaveBeenCalledWith('Home');
  });

  it('keeps the screen and shows the existing leave error on failure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.group.leave).mockRejectedValueOnce(new Error('failed'));
    const renderer = await renderScreen();
    act(() => renderer.root.findByType(NavHeader).props.onPressRight());
    await press(renderer, '방 나가기');

    await act(async () => {
      buttonWithText(renderer, '예')?.props.onPress();
      await Promise.resolve();
    });

    expect(alert).toHaveBeenCalledWith(
      '그룹 탈퇴 실패',
      '그룹에서 나가지 못했어요.',
    );
    expect(mockNavigation.popTo).not.toHaveBeenCalled();
  });

  it('renames the group directly with the existing API and validation UI', async () => {
    const renderer = await renderScreen();
    act(() => renderer.root.findByType(NavHeader).props.onPressRight());
    await press(renderer, '방 이름 바꾸기');

    const input = renderer.root.findByType(TextInput);
    act(() => input.props.onChangeText('  새 아침 모임  '));
    await press(renderer, '저장');

    expect(nunnunApi.group.rename).toHaveBeenCalledTimes(1);
    expect(nunnunApi.group.rename).toHaveBeenCalledWith(7, '새 아침 모임');
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(2);
  });

  it('refreshes member proof images while the focused screen is active', async () => {
    jest.useFakeTimers();
    jest.mocked(nunnunApi.group.detail)
      .mockResolvedValueOnce(detail)
      .mockResolvedValue({
        ...detail,
        members: detail.members.map(member =>
          member.user_id === 22
            ? { ...member, proof_image_url: 'https://example.com/proof.jpg' }
            : member,
        ),
      });
    const renderer = await renderScreen();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(2);
    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.source?.uri === 'https://example.com/proof.jpg'),
    ).toBe(true);
  });

  it('keeps the existing URI when polling returns a new URL for the same proof', async () => {
    jest.useFakeTimers();
    const withProof = (proofImageUrl: string): WakeGroupDetail => ({
      ...detail,
      members: detail.members.map(member =>
        member.user_id === 22
          ? {
              ...member,
              state: 'AWAKE',
              actual_wake_time: '08:03',
              proof_image_url: proofImageUrl,
              proof_expires_at: '2026-08-20T16:03:00+09:00',
            }
          : member,
      ),
    });
    jest.mocked(nunnunApi.group.detail)
      .mockResolvedValueOnce(withProof('https://example.com/proof-old.jpg'))
      .mockResolvedValue(withProof('https://example.com/proof-resigned.jpg'));
    const renderer = await renderScreen();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    const imageUris = renderer.root
      .findAllByType(Image)
      .map(node => node.props.source?.uri);
    expect(imageUris).toContain('https://example.com/proof-old.jpg');
    expect(imageUris).not.toContain('https://example.com/proof-resigned.jpg');
    expect(Image.prefetch).not.toHaveBeenCalled();
  });

  it('applies refreshed eligibility while preserving only the same-proof image URI', async () => {
    jest.useFakeTimers();
    const withEligibility = (
      canWake: boolean,
      blockReason: 'COOLDOWN' | null,
      wakeAvailableAt: string | null,
      proofImageUrl: string,
    ): WakeGroupDetail => ({
      ...detail,
      members: detail.members.map(member => ({
        ...member,
        state: 'AWAKE',
        actual_wake_time: '09:00',
        proof_image_url: proofImageUrl,
        proof_expires_at: '2026-08-20T16:00:00+09:00',
        can_wake: canWake,
        block_reason: blockReason,
        wake_available_at: wakeAvailableAt,
      })),
    });
    jest.mocked(nunnunApi.group.detail)
      .mockResolvedValueOnce(
        withEligibility(
          false,
          'COOLDOWN',
          '2099-08-20T09:30:00+09:00',
          'https://example.com/proof-old.jpg',
        ),
      )
      .mockResolvedValue(
        withEligibility(
          true,
          null,
          null,
          'https://example.com/proof-resigned.jpg',
        ),
      );
    const renderer = await renderScreen();

    expect(buttonWithText(renderer, '깨우기')).toBeUndefined();
    expect(buttonWithText(renderer, '셀프 인증')).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    const wakeButton = buttonWithText(renderer, '깨우기');
    const selfButton = buttonWithText(renderer, '셀프 인증');
    const imageUris = renderer.root
      .findAllByType(Image)
      .map(node => node.props.source?.uri);
    expect(wakeButton?.props.disabled).toBe(false);
    expect(selfButton?.props.disabled).toBe(false);
    expect(imageUris).toContain('https://example.com/proof-old.jpg');
    expect(imageUris).not.toContain('https://example.com/proof-resigned.jpg');

    await act(async () => selfButton?.props.onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'SelfWakeVerification',
      expect.objectContaining({ groupId: 7 }),
    );
  });

  it.each([
    ['NEEDS_HELP' as const, null, '도움이 필요해요'],
    ['AWAKE' as const, 'DND' as const, '수업 중'],
  ])(
    'restores a retained proof after %s/%s visual priority clears',
    async (initialState, initialBlockReason, priorityAccessibilityLabel) => {
      jest.useFakeTimers();
      const proofExpiresAt = '2026-08-20T20:00:00+09:00';
      const initialDetail: WakeGroupDetail = {
        ...detail,
        members: detail.members.map(member =>
          member.user_id === 22
            ? {
                ...member,
                state: initialState,
                actual_wake_time: initialState === 'AWAKE' ? '08:00' : null,
                proof_image_url: 'https://example.com/proof-stable.jpg',
                proof_expires_at: proofExpiresAt,
                can_wake: initialBlockReason === null,
                block_reason: initialBlockReason,
              }
            : member,
        ),
      };
      const clearedDetail: WakeGroupDetail = {
        ...initialDetail,
        members: initialDetail.members.map(member =>
          member.user_id === 22
            ? {
                ...member,
                state: 'AWAKE',
                actual_wake_time: '08:00',
                proof_image_url: 'https://example.com/proof-resigned.jpg',
                can_wake: true,
                block_reason: null,
              }
            : member,
        ),
      };
      jest.mocked(nunnunApi.group.detail)
        .mockResolvedValueOnce(initialDetail)
        .mockResolvedValue(clearedDetail);
      const renderer = await renderScreen();

      expect(
        renderer.root
          .findAllByType(Image)
          .some(node => node.props.accessibilityLabel === priorityAccessibilityLabel),
      ).toBe(true);
      expect(
        renderer.root
          .findAllByType(Image)
          .some(node => node.props.source?.uri === 'https://example.com/proof-stable.jpg'),
      ).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(4000);
        await Promise.resolve();
      });

      const imageUris = renderer.root
        .findAllByType(Image)
        .map(node => node.props.source?.uri);
      expect(imageUris).toContain('https://example.com/proof-stable.jpg');
      expect(imageUris).not.toContain('https://example.com/proof-resigned.jpg');
    },
  );

  it('removes the rendered proof when polling returns a null proof URL', async () => {
    jest.useFakeTimers();
    const withProof: WakeGroupDetail = {
      ...detail,
      members: detail.members.map(member =>
        member.user_id === 22
          ? {
              ...member,
              state: 'AWAKE',
              actual_wake_time: '08:00',
              proof_image_url: 'https://example.com/proof-to-expire.jpg',
              proof_expires_at: '2026-08-20T20:00:00+09:00',
            }
          : member,
      ),
    };
    const withoutProof: WakeGroupDetail = {
      ...withProof,
      members: withProof.members.map(member =>
        member.user_id === 22
          ? { ...member, proof_image_url: null }
          : member,
      ),
    };
    jest.mocked(nunnunApi.group.detail)
      .mockResolvedValueOnce(withProof)
      .mockResolvedValue(withoutProof);
    const renderer = await renderScreen();

    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.source?.uri === 'https://example.com/proof-to-expire.jpg'),
    ).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.source?.uri === 'https://example.com/proof-to-expire.jpg'),
    ).toBe(false);
  });

  it('prefetches and switches URI when proof metadata changes', async () => {
    jest.useFakeTimers();
    const firstDetail: WakeGroupDetail = {
      ...detail,
      members: detail.members.map(member =>
        member.user_id === 22
          ? {
              ...member,
              state: 'AWAKE',
              actual_wake_time: '08:03',
              proof_image_url: 'https://example.com/proof-old.jpg',
              proof_expires_at: '2026-08-20T16:03:00+09:00',
            }
          : member,
      ),
    };
    const nextDetail: WakeGroupDetail = {
      ...firstDetail,
      members: firstDetail.members.map(member =>
        member.user_id === 22
          ? {
              ...member,
              actual_wake_time: '08:07',
              proof_image_url: 'https://example.com/proof-new.jpg',
              proof_expires_at: '2026-08-20T16:07:00+09:00',
            }
          : member,
      ),
    };
    jest.mocked(nunnunApi.group.detail)
      .mockResolvedValueOnce(firstDetail)
      .mockResolvedValue(nextDetail);
    const renderer = await renderScreen();

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Image.prefetch).toHaveBeenCalledWith(
      'https://example.com/proof-new.jpg',
    );
    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.source?.uri === 'https://example.com/proof-new.jpg'),
    ).toBe(true);
  });

  it('pauses polling in background and refreshes immediately on foreground', async () => {
    jest.useFakeTimers();
    await renderScreen();
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(1);

    act(() => appStateChangeHandler?.('background'));
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(1);

    await act(async () => {
      appStateChangeHandler?.('active');
      await Promise.resolve();
    });
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(2);
  });

  it('updates only the cooldown display every second between server polls', async () => {
    jest.useFakeTimers();
    const initialNow = Date.parse('2026-08-20T09:10:01+09:00');
    jest.spyOn(Date, 'now').mockReturnValue(initialNow);
    jest.mocked(nunnunApi.group.detail).mockResolvedValue({
      ...detail,
      members: detail.members.map(member =>
        member.user_id === 22
          ? {
              ...member,
              state: 'AWAKE',
              actual_wake_time: '09:10',
              can_wake: false,
              block_reason: 'COOLDOWN',
              wake_available_at: '2026-08-20T09:30:00+09:00',
            }
          : member,
      ),
    });
    const renderer = await renderScreen();

    expect(renderer.root.findAllByType(Text).map(node => node.props.children)).toContain('19:59');
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(1);

    jest.mocked(Date.now).mockReturnValue(initialNow + 1000);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(renderer.root.findAllByType(Text).map(node => node.props.children)).toContain('19:58');
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(1);
  });
});
