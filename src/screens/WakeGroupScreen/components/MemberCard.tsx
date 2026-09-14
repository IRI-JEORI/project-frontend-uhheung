import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Button from '../../../components/Button';
import { colors } from '../../../theme/tokens';

export interface MemberCardProps {
  width?: number;
  name: string;
  status: 'pending' | 'done' | 'needsHelp' | 'dnd';
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  secondaryLabel: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onPressAction?: () => void;
  photoUri?: string;
}

const CARD_WIDTH = 164;
const CARD_HEIGHT = 219;

const MemberCard = ({
  width = CARD_WIDTH,
  name,
  status,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  actionLabel,
  actionDisabled,
  onPressAction,
  photoUri,
}: MemberCardProps) => {
  const isDone = status === 'done';
  const shouldShowNeedsHelp = status === 'needsHelp';
  const shouldShowDnd = !shouldShowNeedsHelp && status === 'dnd';
  const shouldShowProof = !shouldShowNeedsHelp && !shouldShowDnd && Boolean(photoUri);
  const isCooldown = isDone && secondaryLabel === '쿨다운';
  const isActionDisabled = actionDisabled ?? (isDone || shouldShowDnd);
  const textColor = shouldShowNeedsHelp || shouldShowDnd
    ? colors.white
    : isDone
      ? colors.brown
      : 'rgba(172,172,172,0.85)';

  return (
    <View style={[styles.container, { width }]}>
      <View style={[styles.photo, shouldShowNeedsHelp && styles.helpNeededCard, shouldShowDnd && styles.dndCard]}>
        {shouldShowNeedsHelp ? (
          <View style={styles.helpContent}>
            <Image
              accessibilityLabel="도움이 필요해요"
              source={require('../../../assets/images/wake-help-fire.png')}
              style={styles.helpFire}
              resizeMode="contain"
            />
            <Text style={styles.helpNeededText}>도움이 필요해요!</Text>
          </View>
        ) : shouldShowDnd ? (
          <View style={styles.dndContent}>
            <Image
              accessibilityLabel="수업 중"
              source={require('../../../assets/images/class-in-progress-pen.png')}
              style={styles.dndPen}
              resizeMode="contain"
            />
            <Text style={styles.dndText}>방해하지 말아주세요</Text>
          </View>
        ) : shouldShowProof ? (
          <Image
            source={{ uri: photoUri! }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        ) : (
          // TODO: 실제 인증사진으로 교체
          <View style={styles.photoPlaceholder} />
        )}
        <View style={styles.avatarRow}>
          <View style={[styles.avatarDot, (shouldShowNeedsHelp || shouldShowDnd) && styles.avatarDotOnDark]} />
          <Text style={[styles.name, (shouldShowNeedsHelp || shouldShowDnd) && styles.textOnDark]}>{name}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {primaryValue}
            </Text>
            <Text style={[styles.statLabel, { color: textColor }]}>
              {primaryLabel}
            </Text>
          </View>
          {!isCooldown && (
            <View style={styles.statColumn}>
              <Text style={[styles.statValue, { color: textColor }]}>
                {secondaryValue}
              </Text>
              <Text style={[styles.statLabel, { color: textColor }]}>
                {secondaryLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.buttonWrapper}>
        {isCooldown ? (
          <View
            accessibilityLabel={`쿨다운 ${secondaryValue}`}
            accessibilityRole="timer"
            style={styles.cooldownButton}
          >
            <Text style={styles.cooldownLabel}>쿨다운</Text>
            <Text style={styles.cooldownValue}>{secondaryValue}</Text>
          </View>
        ) : (
          <Button
            label={actionLabel}
            size="medium"
            onPress={isActionDisabled ? undefined : onPressAction}
            disabled={isActionDisabled}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: CARD_WIDTH,
  },
  photo: {
    position: 'relative',
    width: '100%',
    aspectRatio: CARD_WIDTH / CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: colors.scheduleGridGray,
    justifyContent: 'space-between',
    padding: 13,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scheduleGridGray,
  },
  helpNeededCard: {
    backgroundColor: '#FF4B4B',
  },
  dndCard: {
    backgroundColor: '#202224',
  },
  helpContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpFire: {
    width: 80,
    height: 80,
  },
  helpNeededText: {
    marginTop: 1,
    color: colors.white,
    fontFamily: 'PretendardBold',
    fontSize: 14,
  },
  dndContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dndPen: {
    width: 80,
    height: 80,
  },
  dndText: {
    marginTop: 1,
    color: colors.white,
    fontFamily: 'PretendardBold',
    fontSize: 14,
  },
  photoImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatarDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gray,
  },
  avatarDotOnDark: {
    backgroundColor: colors.white,
  },
  name: {
    fontSize: 8,
    fontFamily: 'PretendardSemiBold',
    color: colors.black,
  },
  textOnDark: {
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statColumn: {
    alignItems: 'flex-start',
    gap: 2,
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'PretendardBold',
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'PretendardSemiBold',
  },
  buttonWrapper: {
    marginTop: 12,
  },
  cooldownButton: {
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cooldownLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontFamily: 'PretendardSemiBold',
    fontSize: 10,
  },
  cooldownValue: {
    color: colors.white,
    fontFamily: 'PretendardBold',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
});

export default MemberCard;
