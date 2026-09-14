const CARD_ROW_HORIZONTAL_MARGIN = 26;
export const MEMBER_CARD_GAP = 12;
const MEMBER_CARD_MAX_WIDTH = 164;
const MEMBER_CARD_MIN_WIDTH = 128;
const MEMBER_GRID_MAX_WIDTH = 350;

export const memberGridMetricsForWidth = (viewportWidth: number) => {
  const availableWidth = Math.min(
    MEMBER_GRID_MAX_WIDTH,
    Math.max(0, viewportWidth - CARD_ROW_HORIZONTAL_MARGIN * 2),
  );
  const canUseTwoColumns =
    availableWidth >= MEMBER_CARD_MIN_WIDTH * 2 + MEMBER_CARD_GAP;
  const columns = canUseTwoColumns ? 2 : 1;
  const cardWidth = Math.min(
    MEMBER_CARD_MAX_WIDTH,
    columns === 2
      ? (availableWidth - MEMBER_CARD_GAP) / 2
      : availableWidth,
  );

  return {
    cardWidth,
    columns,
    contentWidth: cardWidth * columns + MEMBER_CARD_GAP * (columns - 1),
  };
};
