import type { WakeGroupMember } from '../../api/types';

export const memberCardStatus = (member: WakeGroupMember) =>
  member.state === 'NEEDS_HELP'
    ? ('needsHelp' as const)
    : !member.is_me && member.block_reason === 'DND'
      ? ('dnd' as const)
      : member.state === 'AWAKE'
        ? ('done' as const)
      : ('pending' as const);

export const dndActionLabel = (wakeAvailableAt: string | null) => {
  if (!wakeAvailableAt) return '방해금지';

  const time = wakeAvailableAt.match(/T(\d{2}):(\d{2})/)?.slice(1).join(':');
  return time ? `${time} 이후 깨우기 가능` : '방해금지';
};

export const cooldownRemainingMinutes = (
  wakeAvailableAt: string | null,
  nowMs = Date.now(),
) => {
  if (!wakeAvailableAt) return null;

  const availableAtMs = new Date(wakeAvailableAt).getTime();
  if (Number.isNaN(availableAtMs)) return null;

  return Math.max(0, Math.ceil((availableAtMs - nowMs) / 60_000));
};

export const cooldownRemainingSeconds = (
  wakeAvailableAt: string | null,
  nowMs = Date.now(),
) => {
  if (!wakeAvailableAt) return null;

  const availableAtMs = new Date(wakeAvailableAt).getTime();
  if (Number.isNaN(availableAtMs)) return null;

  return Math.max(0, Math.ceil((availableAtMs - nowMs) / 1000));
};

export const formatCooldown = (remainingSeconds: number) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const memberCardSecondary = (
  member: WakeGroupMember,
  nowMs = Date.now(),
) => {
  if (member.state === 'AWAKE' && member.block_reason === 'COOLDOWN') {
    const remainingSeconds = cooldownRemainingSeconds(
      member.wake_available_at,
      nowMs,
    );

    return {
      value: remainingSeconds === null ? '--' : formatCooldown(remainingSeconds),
      label: '쿨다운',
    };
  }

  return {
    value: member.remaining_to_target
      ? `${member.remaining_to_target.value}${
          member.remaining_to_target.unit === 'HOUR' ? '시간' : '분'
        }`
      : '--',
    label:
      member.state === 'SLEEPING'
        ? '취침 중'
        : member.remaining_to_target
          ? '목표까지'
          : member.state,
  };
};

export const memberActionLabel = (member: WakeGroupMember) =>
  member.is_me
    ? '셀프 인증'
    : member.can_wake
      ? '깨우기'
      : member.block_reason === 'DND'
        ? dndActionLabel(member.wake_available_at)
        : '대기 중';

export const memberActionDisabled = (member: WakeGroupMember) =>
  member.block_reason !== null || (!member.is_me && !member.can_wake);

export const canOpenWakeConfirmation = (member: WakeGroupMember) =>
  !member.is_me &&
  member.can_wake &&
  member.block_reason === null;
