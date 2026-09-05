import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NavHeader from '../../components/NavHeader';
import PaginationDots from '../../components/PaginationDots';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { ApiError, nunnunApi } from '../../api';
import type {
  PendingWakeSuccess,
  WakeGroupDetail,
  WakeGroupMember,
} from '../../api/types';
import MemberCard from './components/MemberCard';
import {
  canOpenWakeConfirmation,
  memberActionLabel,
  memberCardStatus,
} from './memberCardState';
import { formatTime } from '../../utils/time';

const CARD_ROW_TOP_SPACING = 80;
const CARD_ROW_HORIZONTAL_MARGIN = 26;
const DOTS_TOP_SPACING = 40;
const WAKE_SUCCESS_POLL_INTERVAL_MS = 4000;

const memberPrimary = (member: WakeGroupMember) =>
  member.state === 'AWAKE'
    ? member.actual_wake_time ? formatTime(member.actual_wake_time) : '--:--'
    : member.target_wake_time ? formatTime(member.target_wake_time) : '--:--';

const memberSecondary = (member: WakeGroupMember) =>
  member.remaining_to_target
    ? `${member.remaining_to_target.value}${member.remaining_to_target.unit === 'HOUR' ? '시간' : '분'}`
    : '--';

const WakeGroupScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'WakeGroupDetail'>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'WakeGroupDetail'>>();
  const [detail, setDetail] = useState<WakeGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wakeConfirmMember, setWakeConfirmMember] = useState<WakeGroupMember | null>(null);
  const [wakingReceiverId, setWakingReceiverId] = useState<number | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const wakeInFlightRef = useRef(false);
  const [wakeSuccessEvent, setWakeSuccessEvent] = useState<PendingWakeSuccess | null>(null);
  const [acknowledgingSuccess, setAcknowledgingSuccess] = useState(false);
  const wakeSuccessEventRef = useRef<PendingWakeSuccess | null>(null);
  const pendingSuccessInFlightRef = useRef(false);
  const successAckInFlightRef = useRef(false);
  const screenFocusedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      setDetail(await nunnunApi.group.detail(params.groupId));
    } catch {
      setDetail(null);
      setErrorMessage('그룹 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [params.groupId]);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const checkPendingWakeSuccess = useCallback(async () => {
    if (
      wakeSuccessEventRef.current ||
      pendingSuccessInFlightRef.current ||
      !screenFocusedRef.current
    ) {
      return;
    }
    pendingSuccessInFlightRef.current = true;
    try {
      const event = await nunnunApi.group.getPendingWakeSuccess(params.groupId);
      if (screenFocusedRef.current && event && !wakeSuccessEventRef.current) {
        wakeSuccessEventRef.current = event;
        setWakeSuccessEvent(event);
      }
    } catch {
      // Polling failure is retried while this screen remains focused.
    } finally {
      pendingSuccessInFlightRef.current = false;
    }
  }, [params.groupId]);

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      checkPendingWakeSuccess().catch(() => undefined);
      const interval = setInterval(() => {
        checkPendingWakeSuccess().catch(() => undefined);
      }, WAKE_SUCCESS_POLL_INTERVAL_MS);
      return () => {
        screenFocusedRef.current = false;
        clearInterval(interval);
      };
    }, [checkPendingWakeSuccess]),
  );

  const wake = async (member: WakeGroupMember) => {
    if (!canOpenWakeConfirmation(member)) return false;
    try {
      await nunnunApi.wake.wakeMember(params.groupId, member.user_id);
      await load();
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '깨우기 요청을 보내지 못했어요.';
      Alert.alert('깨우기 실패', message);
      return false;
    }
  };

  const openWakeConfirmation = (member: WakeGroupMember) => {
    if (canOpenWakeConfirmation(member)) {
      setWakeConfirmMember(member);
    }
  };

  const closeWakeConfirmation = () => {
    if (!wakeInFlightRef.current) {
      setWakeConfirmMember(null);
    }
  };

  const confirmWake = async () => {
    if (!wakeConfirmMember || wakeInFlightRef.current) return;

    const receiver = wakeConfirmMember;
    wakeInFlightRef.current = true;
    setWakingReceiverId(receiver.user_id);
    try {
      if (await wake(receiver)) {
        setWakeConfirmMember(null);
      }
    } finally {
      wakeInFlightRef.current = false;
      setWakingReceiverId(null);
    }
  };

  const acknowledgeWakeSuccess = async (sendReward: boolean) => {
    if (!wakeSuccessEvent || successAckInFlightRef.current) return;

    const event = wakeSuccessEvent;
    successAckInFlightRef.current = true;
    setAcknowledgingSuccess(true);
    try {
      await nunnunApi.wake.acknowledgeSuccess(event.wake_request_id);
      wakeSuccessEventRef.current = null;
      setWakeSuccessEvent(null);
      if (sendReward) {
        navigation.navigate('RewardList');
      }
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : '깨우기 성공 알림을 처리하지 못했어요.';
      Alert.alert('알림 처리 실패', message);
    } finally {
      successAckInFlightRef.current = false;
      setAcknowledgingSuccess(false);
    }
  };

  const openLeaveConfirm = () => {
    setMenuVisible(false);
    setLeaveConfirmVisible(true);
  };

  const closeLeaveConfirm = () => {
    if (!leavingGroup) {
      setLeaveConfirmVisible(false);
    }
  };

  const confirmLeaveGroup = async () => {
    if (leavingGroup) return;
    setLeavingGroup(true);
    try {
      await nunnunApi.group.leave(params.groupId);
      setLeaveConfirmVisible(false);
      navigation.navigate('Home');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '그룹에서 나가지 못했어요.';
      Alert.alert('그룹 나가기 실패', message);
    } finally {
      setLeavingGroup(false);
    }
  };

  const selfVerify = (member: WakeGroupMember) => {
    navigation.navigate('SelfWakeVerification', {
      recipientName: member.nickname,
      photographer: 'jiwoo',
      groupId: params.groupId,
      groupName: detail?.name,
    });
  };

  if (loading) {
    return <View style={styles.feedback}><ActivityIndicator color={colors.black} /></View>;
  }
  if (!detail || errorMessage) {
    return <View style={styles.feedback}><Text style={styles.error}>{errorMessage}</Text></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NavHeader
        title={detail.name}
        rightIcon="menu"
        onPressBack={() => navigation.goBack()}
        onPressRight={() => setMenuVisible(true)}
      />
      <View style={styles.cardRow}>
        {detail.members.map(member => {
          const awake = member.state === 'AWAKE';
          return (
            <MemberCard
              key={member.user_id}
              name={member.nickname}
              status={memberCardStatus(member)}
              primaryValue={memberPrimary(member)}
              primaryLabel={awake ? '기상 시간' : '기상 목표'}
              secondaryValue={memberSecondary(member)}
              secondaryLabel={member.state === 'SLEEPING' ? '취침 중' : member.remaining_to_target ? '목표까지' : member.state}
              actionLabel={memberActionLabel(member)}
              onPressAction={member.is_me ? () => selfVerify(member) : () => openWakeConfirmation(member)}
              photoUri={member.proof_image_url ?? undefined}
            />
          );
        })}
      </View>
      <View style={styles.dotsWrapper}><PaginationDots count={Math.max(1, Math.ceil(detail.members.length / 2))} activeIndex={0} /></View>
      <Modal
        animationType="fade"
        onRequestClose={closeWakeConfirmation}
        statusBarTranslucent
        transparent
        visible={wakeConfirmMember !== null}
      >
        <View style={styles.wakeConfirmOverlay}>
          <View style={styles.wakeConfirmPanel}>
            <Image
              accessibilityLabel="주의"
              resizeMode="contain"
              source={require('../../assets/images/wake-caution.png')}
              style={styles.wakeConfirmIcon}
            />
            <Text style={styles.wakeConfirmTitle}>
              {`${wakeConfirmMember?.nickname ?? ''}님을 깨울까요?`}
            </Text>
            <Text style={styles.wakeConfirmDescription}>깨우기 알림을 보낼게요</Text>
            <View style={styles.wakeConfirmActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="안 깨울래요"
                activeOpacity={0.8}
                disabled={wakingReceiverId !== null}
                onPress={closeWakeConfirmation}
                style={[styles.wakeConfirmButton, styles.wakeConfirmCancelButton]}
              >
                <Text style={styles.wakeConfirmCancelText}>안 깨울래요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="깨울게요"
                activeOpacity={0.8}
                disabled={wakingReceiverId !== null}
                onPress={() => confirmWake().catch(() => undefined)}
                style={[styles.wakeConfirmButton, styles.wakeConfirmAcceptButton]}
              >
                <Text style={styles.wakeConfirmAcceptText}>
                  {wakingReceiverId !== null ? '요청 중...' : '깨울게요'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => acknowledgeWakeSuccess(false).catch(() => undefined)}
        statusBarTranslucent
        transparent
        visible={wakeSuccessEvent !== null}
      >
        <View style={styles.wakeConfirmOverlay}>
          <View style={styles.wakeSuccessPanel}>
            <Image
              accessibilityLabel="깨우기 성공"
              resizeMode="contain"
              source={require('../../assets/images/wake-success-clock.png')}
              style={styles.wakeSuccessIcon}
            />
            <Text style={styles.wakeSuccessTitle}>
              {`${wakeSuccessEvent?.receiver.nickname ?? ''}님 깨우기 성공!`}
            </Text>
            <Text style={styles.wakeSuccessDescription}>
              오늘의 리워드를 보내볼까요?
            </Text>
            <View style={styles.wakeSuccessActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="리워드 나중에 보내기"
                activeOpacity={0.8}
                disabled={acknowledgingSuccess}
                onPress={() => acknowledgeWakeSuccess(false).catch(() => undefined)}
                style={[styles.wakeSuccessButton, styles.wakeSuccessLaterButton]}
              >
                <Text style={styles.wakeSuccessLaterText}>나중에</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="리워드 보내기"
                activeOpacity={0.8}
                disabled={acknowledgingSuccess}
                onPress={() => acknowledgeWakeSuccess(true).catch(() => undefined)}
                style={[styles.wakeSuccessButton, styles.wakeSuccessSendButton]}
              >
                <Text style={styles.wakeSuccessSendText}>
                  {acknowledgingSuccess ? '처리 중...' : '보내기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent
        transparent
        visible={menuVisible}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="그룹 메뉴 닫기"
          onPress={() => setMenuVisible(false)}
          style={styles.menuOverlay}
        >
          <Pressable
            onPress={event => event.stopPropagation()}
            style={[styles.menuPanel, { top: insets.top + 52 }]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="그룹 나가기"
              activeOpacity={0.7}
              onPress={openLeaveConfirm}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>그룹 나가기</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeLeaveConfirm}
        statusBarTranslucent
        transparent
        visible={leaveConfirmVisible}
      >
        <View style={styles.wakeConfirmOverlay}>
          <View style={styles.wakeConfirmPanel}>
            <Image
              accessibilityLabel="그룹 나가기 경고"
              resizeMode="contain"
              source={require('../../assets/images/wake-caution.png')}
              style={styles.wakeConfirmIcon}
            />
            <Text style={styles.wakeConfirmTitle}>그룹에서 나갈까요?</Text>
            <View style={styles.wakeConfirmActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="그룹에 남기"
                activeOpacity={0.8}
                disabled={leavingGroup}
                onPress={closeLeaveConfirm}
                style={[styles.wakeConfirmButton, styles.wakeConfirmCancelButton]}
              >
                <Text style={styles.wakeConfirmCancelText}>아니요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="그룹에서 나가기"
                activeOpacity={0.8}
                disabled={leavingGroup}
                onPress={() => confirmLeaveGroup().catch(() => undefined)}
                style={[styles.wakeConfirmButton, styles.wakeConfirmAcceptButton]}
              >
                {leavingGroup ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.wakeConfirmAcceptText}>예</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: CARD_ROW_TOP_SPACING, paddingHorizontal: CARD_ROW_HORIZONTAL_MARGIN },
  dotsWrapper: { alignItems: 'center', marginTop: DOTS_TOP_SPACING },
  feedback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  error: { color: colors.grayBorder, fontFamily: 'PretendardMedium' },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  menuPanel: {
    position: 'absolute',
    right: 20,
    overflow: 'hidden',
    paddingVertical: 7,
    width: 180,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 244, 244, 0.88)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  menuItem: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  menuItemText: {
    color: colors.black,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 20,
  },
  wakeConfirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  wakeConfirmPanel: {
    width: 320,
    height: 315,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.bannerBg,
  },
  wakeConfirmIcon: { width: 104, height: 104, marginTop: 26 },
  wakeConfirmTitle: {
    marginTop: 15,
    color: colors.black,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
  },
  wakeConfirmDescription: {
    marginTop: 6,
    color: colors.grayText,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeConfirmActions: {
    position: 'absolute',
    right: 14,
    bottom: 39,
    left: 14,
    flexDirection: 'row',
    columnGap: 16,
  },
  wakeConfirmButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  wakeConfirmCancelButton: { backgroundColor: colors.gray },
  wakeConfirmAcceptButton: { backgroundColor: '#FF4B4B' },
  wakeConfirmCancelText: {
    color: colors.grayText,
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    lineHeight: 17,
  },
  wakeConfirmAcceptText: {
    color: colors.white,
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    lineHeight: 17,
  },
  wakeSuccessPanel: {
    width: 320,
    height: 315,
    alignItems: 'center',
    paddingTop: 27,
    borderRadius: 24,
    backgroundColor: colors.bannerBg,
    overflow: 'hidden',
  },
  wakeSuccessIcon: { width: 104, height: 104 },
  wakeSuccessTitle: {
    marginTop: 15,
    color: colors.black,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
  },
  wakeSuccessDescription: {
    marginTop: 6,
    color: colors.grayText,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeSuccessActions: {
    position: 'absolute',
    right: 16,
    bottom: 37,
    left: 16,
    flexDirection: 'row',
    columnGap: 16,
  },
  wakeSuccessButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  wakeSuccessLaterButton: { backgroundColor: colors.gray },
  wakeSuccessSendButton: { backgroundColor: '#FF4B4B' },
  wakeSuccessLaterText: {
    color: colors.grayText,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeSuccessSendText: {
    color: colors.white,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
});

export default WakeGroupScreen;
