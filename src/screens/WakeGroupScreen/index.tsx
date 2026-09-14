import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NavHeader from '../../components/NavHeader';
import PaginationDots from '../../components/PaginationDots';
import LeaveGroupConfirmModal from '../../components/LeaveGroupConfirmModal';
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
  memberActionDisabled,
  memberCardSecondary,
  memberActionLabel,
  memberCardStatus,
} from './memberCardState';
import { formatTime } from '../../utils/time';
import {
  MEMBER_CARD_GAP,
  memberGridMetricsForWidth,
} from './memberGridLayout';
import { reconcileProofImageUrls } from './memberProofImageState';

const CARD_ROW_TOP_SPACING = 80;
const DOTS_TOP_SPACING = 40;
const WAKE_SUCCESS_POLL_INTERVAL_MS = 4000;
const isAppActive = (state: AppStateStatus | null) =>
  state !== 'background' && state !== 'inactive';

const leaveGroupErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return '그룹에서 나가지 못했어요.';

  switch (error.code) {
    case 'UNAUTHORIZED':
    case 'INVALID_JWT':
    case 'EXPIRED_JWT':
      return '데모 사용자를 다시 선택해주세요.';
    case 'WAKE_GROUP_ACCESS_DENIED':
    case 'FORBIDDEN':
      return '이 그룹에서 나갈 권한이 없어요.';
    case 'WAKE_GROUP_NOT_FOUND':
      return '깨우기 그룹을 찾을 수 없어요.';
    case 'WAKE_GROUP_MEMBER_NOT_FOUND':
      return '이미 탈퇴했거나 그룹 멤버가 아니에요.';
    default:
      return '그룹에서 나가지 못했어요.';
  }
};

const renameGroupErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return '그룹 이름을 변경하지 못했어요.';

  switch (error.code) {
    case 'VALIDATION_ERROR':
      return '그룹 이름은 공백이 아니어야 하며 50자 이하여야 해요.';
    case 'UNAUTHORIZED':
    case 'INVALID_JWT':
    case 'EXPIRED_JWT':
      return '데모 사용자를 다시 선택해주세요.';
    case 'WAKE_GROUP_ACCESS_DENIED':
    case 'FORBIDDEN':
      return '이 그룹의 이름을 바꿀 권한이 없어요.';
    case 'WAKE_GROUP_NOT_FOUND':
      return '깨우기 그룹을 찾을 수 없어요.';
    default:
      return '그룹 이름을 변경하지 못했어요.';
  }
};

const memberPrimary = (member: WakeGroupMember) =>
  member.state === 'AWAKE'
    ? member.actual_wake_time ? formatTime(member.actual_wake_time) : '--:--'
    : member.target_wake_time ? formatTime(member.target_wake_time) : '--:--';

const WakeGroupScreen = () => {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const memberGrid = memberGridMetricsForWidth(viewportWidth);
  const managementModalScale = Math.min(viewportWidth / 390, 1);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'WakeGroupDetail'>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'WakeGroupDetail'>>();
  const [detail, setDetail] = useState<WakeGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wakeConfirmMember, setWakeConfirmMember] = useState<WakeGroupMember | null>(null);
  const [wakingReceiverId, setWakingReceiverId] = useState<number | null>(null);
  const wakeInFlightRef = useRef(false);
  const [wakeSuccessEvent, setWakeSuccessEvent] = useState<PendingWakeSuccess | null>(null);
  const [acknowledgingSuccess, setAcknowledgingSuccess] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const wakeSuccessEventRef = useRef<PendingWakeSuccess | null>(null);
  const pendingSuccessInFlightRef = useRef(false);
  const successAckInFlightRef = useRef(false);
  const leaveInFlightRef = useRef(false);
  const renameInFlightRef = useRef(false);
  const screenFocusedRef = useRef(false);
  const appActiveRef = useRef(isAppActive(AppState.currentState));
  const detailInFlightRef = useRef(false);
  const detailRequestSequenceRef = useRef(0);
  const detailRef = useRef<WakeGroupDetail | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (detailInFlightRef.current) {
      return;
    }
    const requestSequence = ++detailRequestSequenceRef.current;
    detailInFlightRef.current = true;
    if (showLoading) {
      setLoading(true);
      setErrorMessage(null);
    }
    try {
      const nextDetail = await nunnunApi.group.detail(params.groupId);
      const reconciled = reconcileProofImageUrls(detailRef.current, nextDetail);
      if (!showLoading && reconciled.imageUrisToPrefetch.length > 0) {
        await Promise.all(
          reconciled.imageUrisToPrefetch.map(uri =>
            Image.prefetch(uri).catch(() => false),
          ),
        );
      }
      if (
        screenFocusedRef.current &&
        requestSequence === detailRequestSequenceRef.current
      ) {
        detailRef.current = reconciled.detail;
        setDetail(reconciled.detail);
        setErrorMessage(null);
      }
    } catch {
      if (
        showLoading &&
        screenFocusedRef.current &&
        requestSequence === detailRequestSequenceRef.current
      ) {
        detailRef.current = null;
        setDetail(null);
        setErrorMessage('그룹 정보를 불러오지 못했어요.');
      }
    } finally {
      detailInFlightRef.current = false;
      if (
        showLoading &&
        screenFocusedRef.current &&
        requestSequence === detailRequestSequenceRef.current
      ) {
        setLoading(false);
      }
    }
  }, [params.groupId]);

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
      appActiveRef.current = isAppActive(AppState.currentState);
      load().catch(() => undefined);
      checkPendingWakeSuccess().catch(() => undefined);
      const interval = setInterval(() => {
        if (!appActiveRef.current) {
          return;
        }
        load(false).catch(() => undefined);
        checkPendingWakeSuccess().catch(() => undefined);
      }, WAKE_SUCCESS_POLL_INTERVAL_MS);
      const appStateSubscription = AppState.addEventListener(
        'change',
        (nextState: AppStateStatus) => {
          const becameActive =
            nextState === 'active' && !appActiveRef.current;
          appActiveRef.current = isAppActive(nextState);
          if (becameActive && screenFocusedRef.current) {
            load(false).catch(() => undefined);
            checkPendingWakeSuccess().catch(() => undefined);
          }
        },
      );
      return () => {
        screenFocusedRef.current = false;
        detailRequestSequenceRef.current += 1;
        clearInterval(interval);
        appStateSubscription.remove();
      };
    }, [checkPendingWakeSuccess, load]),
  );

  useFocusEffect(
    useCallback(() => {
      setCurrentTimeMs(Date.now());
      const interval = setInterval(() => setCurrentTimeMs(Date.now()), 1000);
      return () => clearInterval(interval);
    }, []),
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
      await load(false);
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

  const selfVerify = (member: WakeGroupMember) => {
    navigation.navigate('SelfWakeVerification', {
      recipientName: member.nickname,
      photographer: 'jiwoo',
      groupId: params.groupId,
      groupName: detail?.name,
    });
  };

  const confirmLeave = async () => {
    if (leaveInFlightRef.current) return;

    leaveInFlightRef.current = true;
    setLeaving(true);
    try {
      await nunnunApi.group.leave(params.groupId);
      navigation.popTo('Home');
    } catch (leaveError) {
      Alert.alert('그룹 탈퇴 실패', leaveGroupErrorMessage(leaveError));
    } finally {
      leaveInFlightRef.current = false;
      setLeaving(false);
    }
  };

  const openLeaveConfirmation = () => {
    setLeaveConfirmVisible(true);
  };

  const confirmRename = async () => {
    const nextName = renameInput.trim();
    if (!nextName || nextName.length > 50 || renameInFlightRef.current) return;

    renameInFlightRef.current = true;
    setRenaming(true);
    try {
      await nunnunApi.group.rename(params.groupId, nextName);
      setRenameVisible(false);
      await load(false);
    } catch (renameError) {
      Alert.alert('이름 변경 실패', renameGroupErrorMessage(renameError));
    } finally {
      renameInFlightRef.current = false;
      setRenaming(false);
    }
  };

  const openRename = () => {
    setRenameInput(detail?.name ?? '');
    setRenameVisible(true);
  };

  const openGroupMenu = () => {
    setMenuVisible(true);
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
        onPressRight={openGroupMenu}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.cardRow, { width: memberGrid.contentWidth }]}>
          {detail.members.map(member => {
            const awake = member.state === 'AWAKE';
            const secondary = memberCardSecondary(member, currentTimeMs);
            return (
              <MemberCard
                key={member.user_id}
                width={memberGrid.cardWidth}
                name={member.nickname}
                status={memberCardStatus(member)}
                primaryValue={memberPrimary(member)}
                primaryLabel={awake ? '기상 시간' : '기상 목표'}
                secondaryValue={secondary.value}
                secondaryLabel={secondary.label}
                actionLabel={memberActionLabel(member)}
                actionDisabled={memberActionDisabled(member)}
                onPressAction={member.is_me ? () => selfVerify(member) : () => openWakeConfirmation(member)}
                photoUri={member.proof_image_url ?? undefined}
              />
            );
          })}
        </View>
        <View style={styles.dotsWrapper}><PaginationDots count={Math.max(1, Math.ceil(detail.members.length / 2))} activeIndex={0} /></View>
      </ScrollView>
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
            style={[
              styles.menuPanel,
              {
                right: 28 * managementModalScale,
                top: 52 * managementModalScale,
                width: 250 * managementModalScale,
                height: 105 * managementModalScale,
                borderRadius: 30 * managementModalScale,
              },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => {
                setMenuVisible(false);
                openRename();
              }}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>방 이름 바꾸기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => {
                setMenuVisible(false);
                openLeaveConfirmation();
              }}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>방 나가기</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!renaming) setRenameVisible(false);
        }}
        statusBarTranslucent
        transparent
        visible={renameVisible}
      >
        <View style={styles.wakeConfirmOverlay}>
          <View style={styles.renameGroupPanel}>
            <Text style={styles.renameGroupTitle}>그룹 이름 변경</Text>
            <TextInput
              accessibilityLabel="새 그룹 이름"
              autoFocus
              editable={!renaming}
              maxLength={50}
              onChangeText={setRenameInput}
              placeholder="그룹 이름"
              style={styles.renameGroupInput}
              value={renameInput}
            />
            <View style={styles.renameGroupActions}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.8}
                disabled={renaming}
                onPress={() => setRenameVisible(false)}
                style={[styles.wakeConfirmButton, styles.wakeConfirmCancelButton]}
              >
                <Text style={styles.wakeConfirmCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.8}
                disabled={
                  renaming ||
                  renameInput.trim().length === 0 ||
                  renameInput.trim().length > 50
                }
                onPress={() => confirmRename().catch(() => undefined)}
                style={[styles.wakeConfirmButton, styles.wakeConfirmAcceptButton]}
              >
                <Text style={styles.wakeConfirmAcceptText}>
                  {renaming ? '저장 중...' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <LeaveGroupConfirmModal
        onCancel={() => setLeaveConfirmVisible(false)}
        onConfirm={() => confirmLeave().catch(() => undefined)}
        scale={managementModalScale}
        submitting={leaving}
        visible={leaveConfirmVisible}
      />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: {
    alignItems: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MEMBER_CARD_GAP,
    marginTop: CARD_ROW_TOP_SPACING,
  },
  dotsWrapper: { alignItems: 'center', marginTop: DOTS_TOP_SPACING },
  feedback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  error: { color: colors.grayBorder, fontFamily: 'PretendardMedium' },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  menuPanel: {
    position: 'absolute',
    overflow: 'hidden',
    paddingVertical: 7,
    backgroundColor: 'rgba(244, 244, 244, 0.88)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  menuItem: {
    flex: 1,
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
    width: '88%',
    maxWidth: 320,
    height: 315,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.bannerBg,
  },
  renameGroupPanel: {
    width: '88%',
    maxWidth: 320,
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  renameGroupTitle: {
    marginBottom: 20,
    color: colors.black,
    fontFamily: 'PretendardSemiBold',
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  renameGroupInput: {
    height: 48,
    marginBottom: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 8,
    color: colors.black,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
  },
  renameGroupActions: {
    flexDirection: 'row',
    columnGap: 16,
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
    width: '88%',
    maxWidth: 320,
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
