import type { WakeGroupDetail, WakeGroupMember } from '../../api/types';

const isSameProof = (
  previous: WakeGroupMember | undefined,
  next: WakeGroupMember,
) =>
  previous?.proof_image_url != null &&
  next.proof_image_url != null &&
  previous.proof_expires_at != null &&
  previous.proof_expires_at === next.proof_expires_at;

export const reconcileProofImageUrls = (
  previous: WakeGroupDetail | null,
  next: WakeGroupDetail,
) => {
  if (!previous || previous.id !== next.id) {
    return { detail: next, imageUrisToPrefetch: [] as string[] };
  }

  const previousMembers = new Map(
    previous.members.map(member => [member.user_id, member]),
  );
  const imageUrisToPrefetch: string[] = [];
  const members = next.members.map(member => {
    const previousMember = previousMembers.get(member.user_id);
    if (isSameProof(previousMember, member)) {
      return member.proof_image_url === previousMember?.proof_image_url
        ? member
        : { ...member, proof_image_url: previousMember?.proof_image_url ?? null };
    }
    if (member.proof_image_url) {
      imageUrisToPrefetch.push(member.proof_image_url);
    }
    return member;
  });

  return {
    detail: { ...next, members },
    imageUrisToPrefetch,
  };
};
