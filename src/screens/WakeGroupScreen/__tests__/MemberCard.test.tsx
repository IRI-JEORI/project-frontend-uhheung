import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { WakeGroupMember } from '../../../api/types';
import {
  canOpenWakeConfirmation,
  cooldownRemainingMinutes,
  cooldownRemainingSeconds,
  dndActionLabel,
  formatCooldown,
  memberActionDisabled,
  memberActionLabel,
  memberCardSecondary,
  memberCardStatus,
} from '../memberCardState';
import MemberCard from '../components/MemberCard';
import { memberGridMetricsForWidth } from '../memberGridLayout';

const member = (overrides: Partial<WakeGroupMember>): WakeGroupMember => ({
  user_id: 99,
  nickname: '아무 사용자',
  avatar_url: null,
  is_me: false,
  target_wake_time: '09:00',
  next_target_at: null,
  remaining_to_target: null,
  state: 'NORMAL',
  actual_wake_time: null,
  proof_image_url: null,
  proof_expires_at: null,
  can_wake: true,
  block_reason: null,
  wake_available_at: null,
  ...overrides,
});

const renderCard = async (
  status: 'pending' | 'done' | 'needsHelp' | 'dnd',
  actionLabel = '깨우기',
  onPress = jest.fn(),
) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = ReactTestRenderer.create(
      <MemberCard
        name="임의 멤버"
        status={status}
        primaryValue="09:00"
        primaryLabel="기상 목표"
        secondaryValue="--"
        secondaryLabel="NEEDS_HELP"
        actionLabel={actionLabel}
        onPressAction={onPress}
      />,
    );
  });
  return renderer;
};

describe('WakeGroup MemberCard states', () => {
  it('maps NORMAL to pending and AWAKE to done', () => {
    expect(memberCardStatus(member({ state: 'NORMAL' }))).toBe('pending');
    expect(memberCardStatus(member({ state: 'AWAKE' }))).toBe('done');
  });

  it('maps only another DND member to the black class-in-progress card', async () => {
    const otherDnd = member({ can_wake: false, block_reason: 'DND' });
    expect(memberCardStatus(otherDnd)).toBe('dnd');
    expect(memberCardStatus({ ...otherDnd, is_me: true })).toBe('pending');

    const renderer = await renderCard('dnd', '22:00 이후 깨우기 가능');
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    const pen = renderer.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === '수업 중');
    const blackCard = renderer.root
      .findAllByType(View)
      .find(node =>
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style: { backgroundColor?: string }) => style?.backgroundColor === '#202224',
        ),
      );

    expect(labels).toContain('방해하지 말아주세요');
    expect(pen).toBeDefined();
    expect(blackCard).toBeDefined();
  });

  it('uses the API wake availability time and a safe DND fallback', () => {
    expect(dndActionLabel('2026-08-20T22:00:00+09:00')).toBe(
      '22:00 이후 깨우기 가능',
    );
    expect(dndActionLabel(null)).toBe('방해금지');
    expect(dndActionLabel('invalid')).toBe('방해금지');
  });

  it('disables the DND action without invoking wake', async () => {
    const onPress = jest.fn();
    const renderer = await renderCard('dnd', '방해금지', onPress);
    const button = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node => node.findAllByType(Text).some(text => text.props.children === '방해금지'));

    expect(button?.props.disabled).toBe(true);
    expect(button?.props.onPress).toBeUndefined();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps NEEDS_HELP above DND and DND above an AWAKE proof card', () => {
    expect(memberCardStatus(member({ state: 'AWAKE', block_reason: 'DND' }))).toBe('dnd');
    expect(memberCardStatus(member({ state: 'NEEDS_HELP', block_reason: 'DND' }))).toBe(
      'needsHelp',
    );
  });

  it('opens confirmation only for a wakeable other member', () => {
    expect(canOpenWakeConfirmation(member({}))).toBe(true);
    expect(canOpenWakeConfirmation(member({ state: 'NEEDS_HELP' }))).toBe(true);
    expect(canOpenWakeConfirmation(member({ is_me: true }))).toBe(false);
    expect(canOpenWakeConfirmation(member({ can_wake: false }))).toBe(false);
    expect(
      canOpenWakeConfirmation(member({ can_wake: false, block_reason: 'DND' })),
    ).toBe(false);
    expect(canOpenWakeConfirmation(member({ state: 'AWAKE' }))).toBe(true);
  });

  it('uses the latest server eligibility instead of AWAKE to disable actions', () => {
    expect(
      memberActionDisabled(
        member({ state: 'AWAKE', can_wake: false, block_reason: 'COOLDOWN' }),
      ),
    ).toBe(true);
    expect(
      memberActionDisabled(
        member({ state: 'AWAKE', can_wake: true, block_reason: null }),
      ),
    ).toBe(false);
    expect(
      memberActionDisabled(
        member({ is_me: true, state: 'AWAKE', can_wake: true, block_reason: null }),
      ),
    ).toBe(false);
    expect(
      memberActionDisabled(
        member({ can_wake: false, block_reason: 'DND' }),
      ),
    ).toBe(true);
  });

  it('renders a generic NEEDS_HELP card with the red background, fire, and message', async () => {
    const renderer = await renderCard('needsHelp');
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    const fire = renderer.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === '도움이 필요해요');
    const redCard = renderer.root
      .findAllByType(View)
      .find(node =>
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style: { backgroundColor?: string }) =>
            style?.backgroundColor === '#FF4B4B',
        ),
      );

    expect(
      memberCardStatus(member({ state: 'NEEDS_HELP', nickname: '누구든지' })),
    ).toBe('needsHelp');
    expect(labels).toContain('도움이 필요해요!');
    expect(fire).toBeDefined();
    expect(redCard).toBeDefined();
  });

  it('keeps actions based on can_wake and block_reason', () => {
    expect(
      memberActionLabel(member({ state: 'NEEDS_HELP', can_wake: true })),
    ).toBe('깨우기');
    expect(
      memberActionLabel(
        member({ state: 'NEEDS_HELP', can_wake: false, block_reason: 'DND' }),
      ),
    ).toBe('방해금지');
    expect(
      memberActionLabel(
        member({
          state: 'NEEDS_HELP',
          can_wake: false,
          block_reason: 'COOLDOWN',
        }),
      ),
    ).toBe('대기 중');
  });

  it('keeps the wake button active for NEEDS_HELP', async () => {
    const onPress = jest.fn();
    const renderer = await renderCard('needsHelp', '깨우기', onPress);
    const button = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .some(text => text.props.children === '깨우기'),
      );
    act(() => button?.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('formats an awake cooldown as MM:SS from the server availability time', () => {
    const nowMs = Date.parse('2026-08-20T09:10:01+09:00');
    const awakeMember = member({
      state: 'AWAKE',
      can_wake: false,
      block_reason: 'COOLDOWN',
      wake_available_at: '2026-08-20T09:30:00+09:00',
    });

    expect(cooldownRemainingMinutes(awakeMember.wake_available_at, nowMs)).toBe(20);
    expect(cooldownRemainingSeconds(awakeMember.wake_available_at, nowMs)).toBe(1199);
    expect(formatCooldown(1199)).toBe('19:59');
    expect(memberCardSecondary(awakeMember, nowMs)).toEqual({
      value: '19:59',
      label: '쿨다운',
    });
    expect(memberCardSecondary(awakeMember, nowMs + 1000).value).toBe('19:58');
  });

  it.each([null, 'invalid'])('uses a safe cooldown fallback for %p', wakeAvailableAt => {
    expect(
      memberCardSecondary(
        member({
          state: 'AWAKE',
          can_wake: false,
          block_reason: 'COOLDOWN',
          wake_available_at: wakeAvailableAt,
        }),
      ),
    ).toEqual({ value: '--', label: '쿨다운' });
  });

  it('renders cooldown as a timer instead of the waiting button', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(() => {
      renderer = ReactTestRenderer.create(
        <MemberCard
          name="쿨다운 멤버"
          status="done"
          primaryValue="09:10"
          primaryLabel="기상 시간"
          secondaryValue="19:59"
          secondaryLabel="쿨다운"
          actionLabel="대기 중"
          photoUri="https://example.com/cooldown-proof.jpg"
        />,
      );
    });

    const timer = renderer.root
      .findAllByType(View)
      .find(node => node.props.accessibilityRole === 'timer');
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);

    expect(timer?.props.accessibilityLabel).toBe('쿨다운 19:59');
    expect(labels).toContain('쿨다운');
    expect(labels).toContain('19:59');
    expect(labels).not.toContain('대기 중');
    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.source?.uri === 'https://example.com/cooldown-proof.jpg'),
    ).toBe(true);
  });

  it.each([
    ['needsHelp' as const, '도움이 필요해요'],
    ['dnd' as const, '수업 중'],
  ])('shows %s UI instead of a retained proof image', async (status, accessibilityLabel) => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(() => {
      renderer = ReactTestRenderer.create(
        <MemberCard
          name="상태 우선 멤버"
          status={status}
          primaryValue="09:00"
          primaryLabel="기상 시간"
          secondaryValue="--"
          secondaryLabel="상태"
          actionLabel="대기 중"
          photoUri="https://example.com/retained-proof.jpg"
        />,
      );
    });

    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.accessibilityLabel === accessibilityLabel),
    ).toBe(true);
    expect(
      renderer.root
        .findAllByType(Image)
        .some(node => node.props.source?.uri === 'https://example.com/retained-proof.jpg'),
    ).toBe(false);
  });

  it('keeps server cooldown eligibility at 00:00 until polling updates it', () => {
    const cooldownMember = member({
      state: 'AWAKE',
      can_wake: false,
      block_reason: 'COOLDOWN',
      wake_available_at: '2026-08-20T09:30:00+09:00',
    });

    expect(
      memberCardSecondary(
        cooldownMember,
        Date.parse('2026-08-20T09:30:00+09:00'),
      ),
    ).toEqual({ value: '00:00', label: '쿨다운' });
    expect(memberActionDisabled(cooldownMember)).toBe(true);
  });

  it('can enable an AWAKE card action when the server allows it', async () => {
    const onPress = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(() => {
      renderer = ReactTestRenderer.create(
        <MemberCard
          name="기상 완료 멤버"
          status="done"
          primaryValue="09:00"
          primaryLabel="기상 시간"
          secondaryValue="--"
          secondaryLabel="AWAKE"
          actionLabel="깨우기"
          actionDisabled={false}
          onPressAction={onPress}
        />,
      );
    });

    const button = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node => node.findAllByType(Text).some(text => text.props.children === '깨우기'));
    act(() => button?.props.onPress());
    expect(button?.props.disabled).toBe(false);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal wake action unchanged', async () => {
    const onPress = jest.fn();
    const renderer = await renderCard('pending', '깨우기', onPress);
    const button = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node => node.findAllByType(Text).some(text => text.props.children === '깨우기'));

    act(() => button?.props.onPress());
    expect(button?.props.disabled).toBe(false);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fills a responsive photo container edge to edge', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(() => {
      renderer = ReactTestRenderer.create(
        <MemberCard
          width={128}
          name="사진 멤버"
          status="done"
          primaryValue="08:00"
          primaryLabel="기상 시간"
          secondaryValue="--"
          secondaryLabel="목표까지"
          actionLabel="완료"
          photoUri="https://example.com/proof.jpg"
        />,
      );
    });

    const photo = renderer.root
      .findAllByType(Image)
      .find(node => node.props.source?.uri === 'https://example.com/proof.jpg');
    expect(photo?.props.resizeMode).toBe('cover');
    expect(StyleSheet.flatten(photo?.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(StyleSheet.flatten(photo?.parent?.props.style)).toMatchObject({
      position: 'relative',
      width: '100%',
      overflow: 'hidden',
    });
  });
});

describe('responsive member grid', () => {
  it.each([
    [320, 2, 128],
    [402, 2, 164],
    [600, 2, 164],
  ])('uses accessible card widths at %ipx', (width, columns, cardWidth) => {
    expect(memberGridMetricsForWidth(width)).toMatchObject({
      columns,
      cardWidth,
    });
  });
});
