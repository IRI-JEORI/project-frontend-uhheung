import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import type { RootStackParamList } from '../../App';
import { Colors } from '../constants/Colors';
import { ApiError, nunnunApi } from '../api';
import type { WakeGroupDetail, WakeGroupMember } from '../api/types';
import { formatTime } from '../utils/time';
import {
  AI_FRIEND_ENABLED_STORAGE_KEYS,
  AI_FRIEND_PROMPT_STORAGE_KEY,
  DEMO_GROUP_CAPACITY_STORAGE_KEY,
  DEMO_SCHEDULE_STATUS_STORAGE_KEYS,
  JIWOO_WAKE_GROUP_STORAGE_KEY,
  JIWOO_WAKE_PHOTO_STORAGE_KEY,
  JIWOO_WAKE_EXHAUSTED_STORAGE_KEY,
  JIWOO_WAKE_REQUEST_STORAGE_KEY,
  JIWOO_WAKE_SUCCESS_STORAGE_KEY,
  MINJU_WAKE_PHOTO_STORAGE_KEY,
  MINJU_WAKE_GROUP_STORAGE_KEY,
  MINJU_WAKE_REQUEST_STORAGE_KEY,
  MINJU_WAKE_SUCCESS_STORAGE_KEY,
  WAKE_GROUP_INVITE_CODE_STORAGE_KEY,
  WAKE_GROUP_MINJU_JOINED_STORAGE_KEY,
} from '../constants/DemoUser';
import MemberStatusLightGray from '../assets/images/member-status-light-gray.svg';
import MemberStatusWhite from '../assets/images/member-status-white.svg';
import LeaveGroupConfirmModal from '../components/LeaveGroupConfirmModal';

const DESIGN_WIDTH = 390;
const MAX_CONTENT_WIDTH = 430;

type Props = NativeStackScreenProps<RootStackParamList, 'WaitingForMembers'>;

export const WaitingForMembersScreen = ({ navigation, route }: Props) => {
  const groupId = route.params?.groupId;
  const isMinjuViewer = route.params?.viewer === 'minju';
  const [groupDetail, setGroupDetail] = useState<WakeGroupDetail | null>(null);
  const [groupDetailLoading, setGroupDetailLoading] = useState(
    groupId !== undefined,
  );
  const [groupDetailError, setGroupDetailError] = useState<string | null>(null);
  const [wakeDemoState, setWakeDemoState] = useState({
    menuVisible: false,
    hasMinjuJoined: isMinjuViewer,
    selfPhotoPath: null as string | null,
    minjuPhotoPath: null as string | null,
    hasMinjuWakeRequest: false,
    hasJiwooWakeRequest: false,
    hasJiwooWakeExhausted: false,
    scheduleStatus: 'available' as 'inClass' | 'available',
    selfScheduleStatus: 'available' as 'inClass' | 'available',
    wakeConfirmVisible: false,
    wakeLockedVisible: false,
    wakeSuccessVisible: false,
    leaveConfirmVisible: false,
    aiFriendPromptVisible: false,
    aiFriendEnabled: false,
    inviteFriendBannerVisible: false,
    groupCapacityFull: false,
    capacityFullVisible: false,
    expandedPhoto: null as null | { path: string; memberName: string },
  });
  const { width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(viewportWidth, MAX_CONTENT_WIDTH);
  const scale = Math.min(contentWidth / DESIGN_WIDTH, 1);
  useFocusEffect(
    useCallback(() => {
      if (groupId === undefined) {
        return undefined;
      }

      let isActive = true;
      setGroupDetailLoading(true);
      setGroupDetailError(null);

      nunnunApi.group
        .detail(groupId)
        .then(detail => {
          if (isActive) {
            setGroupDetail(detail);
          }
        })
        .catch(error => {
          if (!isActive) {
            return;
          }

          setGroupDetail(null);
          if (error instanceof ApiError) {
            if (error.status === 401) {
              setGroupDetailError('데모 사용자를 다시 선택해주세요.');
            } else if (error.status === 403) {
              setGroupDetailError('이 그룹을 볼 권한이 없어요.');
            } else if (error.status === 404) {
              setGroupDetailError('존재하지 않는 그룹이에요.');
            } else {
              setGroupDetailError('그룹 정보를 불러오지 못했어요.');
            }
          } else {
            setGroupDetailError('그룹 정보를 불러오지 못했어요.');
          }
        })
        .finally(() => {
          if (isActive) {
            setGroupDetailLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [groupId]),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      Promise.all([
        AsyncStorage.getItem(WAKE_GROUP_MINJU_JOINED_STORAGE_KEY),
        AsyncStorage.getItem(JIWOO_WAKE_PHOTO_STORAGE_KEY),
        AsyncStorage.getItem(MINJU_WAKE_PHOTO_STORAGE_KEY),
        AsyncStorage.getItem(MINJU_WAKE_REQUEST_STORAGE_KEY),
        AsyncStorage.getItem(JIWOO_WAKE_REQUEST_STORAGE_KEY),
        AsyncStorage.getItem(JIWOO_WAKE_EXHAUSTED_STORAGE_KEY),
        AsyncStorage.getItem(
          DEMO_SCHEDULE_STATUS_STORAGE_KEYS[isMinjuViewer ? 'jiwoo' : 'minju'],
        ),
        AsyncStorage.getItem(
          DEMO_SCHEDULE_STATUS_STORAGE_KEYS[isMinjuViewer ? 'minju' : 'jiwoo'],
        ),
        AsyncStorage.getItem(
          isMinjuViewer
            ? MINJU_WAKE_SUCCESS_STORAGE_KEY
            : JIWOO_WAKE_SUCCESS_STORAGE_KEY,
        ),
        AsyncStorage.getItem(AI_FRIEND_PROMPT_STORAGE_KEY),
        AsyncStorage.getItem(
          AI_FRIEND_ENABLED_STORAGE_KEYS[isMinjuViewer ? 'minju' : 'jiwoo'],
        ),
        AsyncStorage.getItem(DEMO_GROUP_CAPACITY_STORAGE_KEY),
      ])
        .then(
          ([
            savedJoinedState,
            savedPhotoPath,
            savedMinjuPhotoPath,
            savedWakeRequest,
            savedJiwooWakeRequest,
            savedJiwooWakeExhausted,
            savedScheduleStatus,
            savedSelfScheduleStatus,
            savedWakeSuccess,
            aiFriendPromptUser,
            savedAiFriendEnabled,
            savedGroupCapacity,
          ]) => {
            if (isActive) {
              setWakeDemoState(state => ({
                ...state,
                hasMinjuJoined: savedJoinedState === 'true',
                selfPhotoPath: savedPhotoPath,
                minjuPhotoPath: savedMinjuPhotoPath,
                hasMinjuWakeRequest: savedWakeRequest === 'true',
                hasJiwooWakeRequest: savedJiwooWakeRequest === 'true',
                hasJiwooWakeExhausted: savedJiwooWakeExhausted === 'true',
                scheduleStatus:
                  savedScheduleStatus === 'inClass' ? 'inClass' : 'available',
                selfScheduleStatus:
                  savedSelfScheduleStatus === 'inClass'
                    ? 'inClass'
                    : 'available',
                wakeSuccessVisible: savedWakeSuccess === 'true',
                aiFriendPromptVisible:
                  aiFriendPromptUser === (isMinjuViewer ? 'minju' : 'jiwoo'),
                aiFriendEnabled: savedAiFriendEnabled === 'true',
                groupCapacityFull: savedGroupCapacity === 'full',
              }));
            }
          },
        )
        .catch(() => undefined);

      return () => {
        isActive = false;
      };
    }, [isMinjuViewer]),
  );

  const wakeMinju = async () => {
    await AsyncStorage.setItem(MINJU_WAKE_REQUEST_STORAGE_KEY, 'true');
    setWakeDemoState(state => ({
      ...state,
      hasMinjuWakeRequest: true,
    }));
  };

  const wakeJiwoo = async () => {
    await AsyncStorage.setItem(JIWOO_WAKE_REQUEST_STORAGE_KEY, 'true');
    setWakeDemoState(state => ({
      ...state,
      hasJiwooWakeRequest: true,
      wakeConfirmVisible: false,
    }));
  };

  const copyInviteCode = async () => {
    const inviteCode = await AsyncStorage.getItem(
      WAKE_GROUP_INVITE_CODE_STORAGE_KEY,
    );

    if (inviteCode) {
      Clipboard.setString(inviteCode);
    }
  };

  const clearWakeSuccess = async () => {
    await AsyncStorage.removeItem(
      isMinjuViewer
        ? MINJU_WAKE_SUCCESS_STORAGE_KEY
        : JIWOO_WAKE_SUCCESS_STORAGE_KEY,
    );
    setWakeDemoState(state => ({
      ...state,
      wakeSuccessVisible: false,
    }));
  };

  const openRewardList = async () => {
    await clearWakeSuccess();
    navigation.navigate('RewardList');
  };

  const openLeaveConfirm = () => {
    setWakeDemoState(state => ({
      ...state,
      menuVisible: false,
      leaveConfirmVisible: true,
    }));
  };

  const closeLeaveConfirm = () => {
    setWakeDemoState(state => ({ ...state, leaveConfirmVisible: false }));
  };

  const leaveGroup = async () => {
    if (isMinjuViewer) {
      await Promise.all([
        AsyncStorage.removeItem(MINJU_WAKE_GROUP_STORAGE_KEY),
        AsyncStorage.removeItem(MINJU_WAKE_PHOTO_STORAGE_KEY),
        AsyncStorage.removeItem(MINJU_WAKE_REQUEST_STORAGE_KEY),
        AsyncStorage.removeItem(MINJU_WAKE_SUCCESS_STORAGE_KEY),
        AsyncStorage.setItem(WAKE_GROUP_MINJU_JOINED_STORAGE_KEY, 'false'),
        AsyncStorage.setItem(AI_FRIEND_PROMPT_STORAGE_KEY, 'jiwoo'),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.removeItem(JIWOO_WAKE_GROUP_STORAGE_KEY),
        AsyncStorage.removeItem(JIWOO_WAKE_PHOTO_STORAGE_KEY),
        AsyncStorage.removeItem(JIWOO_WAKE_REQUEST_STORAGE_KEY),
        AsyncStorage.removeItem(JIWOO_WAKE_SUCCESS_STORAGE_KEY),
        AsyncStorage.removeItem(JIWOO_WAKE_EXHAUSTED_STORAGE_KEY),
        AsyncStorage.removeItem(WAKE_GROUP_INVITE_CODE_STORAGE_KEY),
        AsyncStorage.setItem(WAKE_GROUP_MINJU_JOINED_STORAGE_KEY, 'false'),
        AsyncStorage.setItem(AI_FRIEND_PROMPT_STORAGE_KEY, 'minju'),
      ]);
    }

    closeLeaveConfirm();
    navigation.popTo('Home');
  };

  const dismissAiFriendPrompt = async (enabled: boolean) => {
    const viewer = isMinjuViewer ? 'minju' : 'jiwoo';
    await Promise.all([
      AsyncStorage.removeItem(AI_FRIEND_PROMPT_STORAGE_KEY),
      AsyncStorage.setItem(
        AI_FRIEND_ENABLED_STORAGE_KEYS[viewer],
        enabled ? 'true' : 'false',
      ),
    ]);
    setWakeDemoState(state => ({
      ...state,
      aiFriendPromptVisible: false,
      aiFriendEnabled: enabled,
      inviteFriendBannerVisible: !enabled,
    }));
  };

  const firstMemberPhotoPath = isMinjuViewer
    ? wakeDemoState.minjuPhotoPath
    : wakeDemoState.selfPhotoPath;
  const secondMemberPhotoPath = isMinjuViewer
    ? wakeDemoState.selfPhotoPath
    : wakeDemoState.minjuPhotoPath;
  const bothMembersAwake = Boolean(
    wakeDemoState.selfPhotoPath && wakeDemoState.minjuPhotoPath,
  );
  const isWakeCompleted = Boolean(
    (firstMemberPhotoPath || wakeDemoState.hasJiwooWakeExhausted) &&
      !isMinjuViewer &&
      !secondMemberPhotoPath,
  );
  const isJiwooBaseState = Boolean(
    !isMinjuViewer &&
      !firstMemberPhotoPath &&
      !secondMemberPhotoPath &&
      !wakeDemoState.hasJiwooWakeExhausted,
  );
  const isScheduleRestricted =
    wakeDemoState.hasMinjuJoined && wakeDemoState.scheduleStatus === 'inClass';
  const isSelfScheduleRestricted =
    wakeDemoState.selfScheduleStatus === 'inClass';

  const wakeBackendMember = useCallback(
    async (receiverId: number) => {
      if (groupId === undefined) {
        return;
      }

      await nunnunApi.wake.wakeMember(groupId, receiverId);
      const refreshedDetail = await nunnunApi.group.detail(groupId);
      setGroupDetail(refreshedDetail);
    },
    [groupId],
  );

  const leaveBackendGroup = useCallback(async () => {
    if (groupId === undefined) {
      return;
    }

    await nunnunApi.group.leave(groupId);
    navigation.popTo('Home');
  }, [groupId, navigation]);

  const renameBackendGroup = useCallback(
    async (name: string) => {
      if (groupId === undefined) {
        return;
      }

      await nunnunApi.group.rename(groupId, name);
      const refreshedDetail = await nunnunApi.group.detail(groupId);
      setGroupDetail(refreshedDetail);
    },
    [groupId],
  );

  if (groupId !== undefined) {
    return (
      <BackendWakeGroupDetail
        detail={groupDetail}
        error={groupDetailError}
        fallbackName={route.params?.groupName}
        loading={groupDetailLoading}
        onBack={() => navigation.popTo('Home')}
        onLeave={leaveBackendGroup}
        onRename={renameBackendGroup}
        onSelfVerify={() =>
          navigation.navigate('SelfWakeVerification', {
            recipientName:
              groupDetail?.members.find(member => member.is_me)?.nickname ??
              '나',
            photographer: route.params?.viewer ?? 'jiwoo',
            groupId,
            groupName: groupDetail?.name ?? route.params?.groupName,
          })
        }
        onWake={wakeBackendMember}
        scale={scale}
        width={contentWidth}
      />
    );
  }

  if (wakeDemoState.expandedPhoto) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          backgroundColor={Colors.background}
          barStyle="dark-content"
        />
        <View style={[styles.container, { width: contentWidth }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹 화면으로 돌아가기"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() =>
              setWakeDemoState(state => ({ ...state, expandedPhoto: null }))
            }
            style={[
              styles.headerIconButton,
              {
                left: 28 * scale,
                top: 9 * scale,
                width: 24 * scale,
                height: 24 * scale,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/images/chevron-left.png')}
              style={styles.fullImage}
            />
          </TouchableOpacity>

          <Text style={[styles.groupTitle, { top: 20 * scale }]}>
            {route.params?.groupName || '아침야호'}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹 메뉴"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: true }))
            }
            style={[
              styles.headerIconButton,
              {
                right: 27 * scale,
                top: 11 * scale,
                width: 20 * scale,
                height: 20 * scale,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/images/menu.png')}
              style={styles.fullImage}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.expandedPhotoCard,
              {
                left: 24 * scale,
                top: 129 * scale,
                width: 354 * scale,
                height: 451 * scale,
                borderRadius: 16 * scale,
              },
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={`${wakeDemoState.expandedPhoto.memberName} 인증사진 확대`}
              resizeMode="cover"
              source={{ uri: `file://${wakeDemoState.expandedPhoto.path}` }}
              style={styles.memberPhoto}
            />
            <View
              style={[
                styles.expandedMemberIdentity,
                { left: 11 * scale, top: 12 * scale },
              ]}
            >
              <MemberStatusWhite width={35 * scale} height={33 * scale} />
              <Text style={styles.expandedMemberMeta}>
                {wakeDemoState.expandedPhoto.memberName} · 8시간 남음
              </Text>
            </View>
            <View
              style={[
                styles.expandedPhotoDetails,
                { left: 25 * scale, right: 25 * scale, bottom: 33 * scale },
              ]}
            >
              <View>
                <Text style={styles.expandedPhotoValue}>09:03</Text>
                <Text style={styles.expandedPhotoLabel}>기상 시간</Text>
              </View>
              <View>
                <Text style={styles.expandedPhotoValue}>5시간째</Text>
                <Text style={styles.expandedPhotoLabel}>기상 중</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (wakeDemoState.groupCapacityFull) {
    const fullMembers = [
      {
        key: 'member-1',
        left: 21,
        top: 145,
        name: '눈눈',
        remaining: '8시간 남음',
        photo: require('../assets/images/full-group-member-1.png'),
        buttonText: '깨우기',
        buttonColor: '#FF4B4B',
      },
      {
        key: 'member-2',
        left: 211,
        top: 145,
        name: '지우',
        remaining: '0시간 남음',
        photo: null,
        buttonText: '지금 인증할게요',
        buttonColor: '#202224',
      },
      {
        key: 'member-3',
        left: 21,
        top: 435,
        name: '눈눈',
        remaining: '8시간 남음',
        photo: require('../assets/images/full-group-member-3.png'),
        buttonText: '기상 완료',
        buttonColor: '#202224',
      },
      {
        key: 'member-4',
        left: 211,
        top: 435,
        name: '지우',
        remaining: '0시간 남음',
        photo: require('../assets/images/full-group-member-2.png'),
        buttonText: '깨우기',
        buttonColor: '#FF4B4B',
      },
    ];

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          backgroundColor={Colors.background}
          barStyle="dark-content"
        />
        <View style={[styles.container, { width: contentWidth }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="홈으로 이동"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() => navigation.popTo('Home')}
            style={[
              styles.headerIconButton,
              {
                left: 28 * scale,
                top: 9 * scale,
                width: 24 * scale,
                height: 24 * scale,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/images/chevron-left.png')}
              style={styles.fullImage}
            />
          </TouchableOpacity>
          <Text style={[styles.groupTitle, { top: 20 * scale }]}>
            {route.params?.groupName || '아침 야호'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹 메뉴"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: true }))
            }
            style={[
              styles.headerIconButton,
              {
                right: 27 * scale,
                top: 11 * scale,
                width: 20 * scale,
                height: 20 * scale,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/images/menu.png')}
              style={styles.fullImage}
            />
          </TouchableOpacity>

          {fullMembers.map(member => (
            <React.Fragment key={member.key}>
              <View
                style={[
                  styles.fullCapacityMemberCard,
                  {
                    left: member.left * scale,
                    top: member.top * scale,
                    width: (member.left === 21 ? 172 : 170) * scale,
                    height: 219 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              >
                {member.photo && (
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={`${member.name} 인증사진`}
                    resizeMode="cover"
                    source={member.photo}
                    style={styles.memberPhoto}
                  />
                )}
                <View
                  style={[
                    styles.memberIdentity,
                    { left: 9 * scale, top: 9 * scale, columnGap: 3 * scale },
                  ]}
                >
                  <MemberStatusWhite
                    width={16.78 * scale}
                    height={16 * scale}
                  />
                  <Text style={[styles.memberName, styles.memberNameOnPhoto]}>
                    {member.name}
                  </Text>
                  <View
                    style={[styles.memberMetaDot, styles.memberMetaDotOnPhoto]}
                  />
                  <Text style={[styles.memberName, styles.memberNameOnPhoto]}>
                    {member.remaining}
                  </Text>
                </View>
                <View
                  style={[
                    styles.fullCapacitySleepDetails,
                    { bottom: 17 * scale },
                  ]}
                >
                  <View
                    style={[
                      styles.fullCapacityFirstDetailColumn,
                      { width: 86 * scale },
                    ]}
                  >
                    <Text style={styles.fullCapacityDetailValue}>09:03</Text>
                    <Text style={styles.fullCapacityDetailLabel}>
                      기상 시간
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.fullCapacitySecondDetailColumn,
                      { width: 86 * scale },
                    ]}
                  >
                    <Text style={styles.fullCapacityDetailValue}>
                      {member.name === '눈눈' ? '5시간째' : '1시간'}
                    </Text>
                    <Text style={styles.fullCapacityDetailLabel}>
                      {member.name === '눈눈' ? '기상 중' : '목표까지'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={member.buttonText}
                activeOpacity={0.8}
                style={[
                  styles.fullCapacityActionButton,
                  {
                    left: member.left * scale,
                    top: (member.top + 228) * scale,
                    width: 171 * scale,
                    height: 44 * scale,
                    borderRadius: 8 * scale,
                    backgroundColor: member.buttonColor,
                  },
                ]}
              >
                <Text style={styles.fullCapacityActionText}>
                  {member.buttonText}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          <View
            pointerEvents="none"
            style={[
              styles.fullCapacityPageControl,
              { bottom: 22 * scale, columnGap: 8 * scale },
            ]}
          >
            <View
              style={[
                styles.fullCapacityPageDot,
                styles.fullCapacityPageDotActive,
                {
                  width: 8 * scale,
                  height: 8 * scale,
                  borderRadius: 4 * scale,
                },
              ]}
            />
            <View
              style={[
                styles.fullCapacityPageDot,
                {
                  width: 8 * scale,
                  height: 8 * scale,
                  borderRadius: 4 * scale,
                },
              ]}
            />
          </View>

          <Modal
            animationType="fade"
            onRequestClose={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: false }))
            }
            statusBarTranslucent
            transparent
            visible={wakeDemoState.menuVisible}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="그룹 메뉴 닫기"
              onPress={() =>
                setWakeDemoState(state => ({ ...state, menuVisible: false }))
              }
              style={styles.menuOverlay}
            >
              <Pressable
                onPress={event => event.stopPropagation()}
                style={[
                  styles.menuPanel,
                  {
                    right: Math.max(
                      (viewportWidth - contentWidth) / 2 + 28 * scale,
                      20,
                    ),
                    top: insets.top + 52 * scale,
                    width: 250 * scale,
                    height: 140 * scale,
                    borderRadius: 30 * scale,
                  },
                ]}
              >
                {['방 나가기', '초대 코드 복사하기', '방 이름 바꾸기'].map(
                  item => (
                    <TouchableOpacity
                      key={item}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                      onPress={
                        item === '방 나가기'
                          ? openLeaveConfirm
                          : item === '초대 코드 복사하기'
                          ? () =>
                              setWakeDemoState(state => ({
                                ...state,
                                menuVisible: false,
                                capacityFullVisible: true,
                              }))
                          : undefined
                      }
                      style={styles.menuItem}
                    >
                      <Text style={styles.menuItemText}>{item}</Text>
                    </TouchableOpacity>
                  ),
                )}
              </Pressable>
            </Pressable>
          </Modal>
          <CapacityFullModal
            onClose={() =>
              setWakeDemoState(state => ({
                ...state,
                capacityFullVisible: false,
              }))
            }
            scale={scale}
            visible={wakeDemoState.capacityFullVisible}
          />
          <LeaveGroupConfirmModal
            onCancel={closeLeaveConfirm}
            onConfirm={() => leaveGroup().catch(() => undefined)}
            scale={scale}
            visible={wakeDemoState.leaveConfirmVisible}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!isMinjuViewer && !wakeDemoState.hasMinjuJoined) {
    const emptySlots = [
      ...(wakeDemoState.aiFriendEnabled
        ? []
        : [{ left: 211, top: 145, buttonTop: 373 }]),
      { left: 23, top: 435, buttonTop: 663 },
      { left: 212, top: 435, buttonTop: 663 },
    ];

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          backgroundColor={Colors.background}
          barStyle="dark-content"
        />
        <View style={[styles.container, { width: contentWidth }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="홈으로 이동"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() => navigation.popTo('Home')}
            style={[
              styles.headerIconButton,
              {
                left: 28 * scale,
                top: 9 * scale,
                width: 24 * scale,
                height: 24 * scale,
              },
            ]}
          >
            <Image
              source={require('../assets/images/chevron-left.png')}
              resizeMode="contain"
              style={styles.fullImage}
            />
          </TouchableOpacity>

          <Text style={[styles.groupTitle, { top: 20 * scale }]}>
            {route.params?.groupName || '아침 야호'}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹 메뉴"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: true }))
            }
            style={[
              styles.headerIconButton,
              {
                right: 27 * scale,
                top: 11 * scale,
                width: 20 * scale,
                height: 20 * scale,
              },
            ]}
          >
            <Image
              source={require('../assets/images/menu.png')}
              resizeMode="contain"
              style={styles.fullImage}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.inviteMemberCard,
              styles.inviteSelfCard,
              {
                left: 21 * scale,
                top: 145 * scale,
                width: 172 * scale,
                height: 219 * scale,
                borderRadius: 8 * scale,
              },
            ]}
          >
            {wakeDemoState.selfPhotoPath && (
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="눈눈 인증사진"
                resizeMode="cover"
                source={{ uri: `file://${wakeDemoState.selfPhotoPath}` }}
                style={styles.memberPhoto}
              />
            )}
            <View
              style={[
                styles.inviteMemberMeta,
                { left: 11 * scale, top: 10 * scale },
              ]}
            >
              {wakeDemoState.selfPhotoPath ? (
                <MemberStatusWhite width={17 * scale} height={16 * scale} />
              ) : (
                <MemberStatusLightGray width={17 * scale} height={16 * scale} />
              )}
              <Text
                style={[
                  styles.inviteMetaText,
                  wakeDemoState.selfPhotoPath && styles.memberNameOnPhoto,
                ]}
              >
                눈눈
              </Text>
              <View
                style={[
                  styles.inviteMetaDot,
                  wakeDemoState.selfPhotoPath && styles.memberMetaDotOnPhoto,
                ]}
              />
              <Text
                style={[
                  styles.inviteMetaText,
                  wakeDemoState.selfPhotoPath && styles.memberNameOnPhoto,
                ]}
              >
                8시간 남음
              </Text>
            </View>
            <View
              style={[
                styles.inviteSleepDetails,
                { left: 15 * scale, bottom: 17 * scale },
              ]}
            >
              <View style={styles.sleepDetailColumn}>
                <Text
                  style={[
                    styles.inviteSleepValue,
                    wakeDemoState.selfPhotoPath && styles.memberNameOnPhoto,
                  ]}
                >
                  09:03
                </Text>
                <Text
                  style={[
                    styles.inviteSleepLabel,
                    wakeDemoState.selfPhotoPath && styles.memberNameOnPhoto,
                  ]}
                >
                  기상 시간
                </Text>
              </View>
              <View style={styles.sleepDetailColumn}>
                <Text
                  style={[
                    styles.inviteSleepValue,
                    wakeDemoState.selfPhotoPath && styles.memberNameOnPhoto,
                  ]}
                >
                  5시간째
                </Text>
                <Text
                  style={[
                    styles.inviteSleepLabel,
                    wakeDemoState.selfPhotoPath && styles.memberNameOnPhoto,
                  ]}
                >
                  기상 중
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isSelfScheduleRestricted ? '방해 금지' : '지금 인증할게요'
            }
            activeOpacity={isSelfScheduleRestricted ? 1 : 0.8}
            disabled={isSelfScheduleRestricted}
            onPress={
              isSelfScheduleRestricted
                ? undefined
                : () =>
                    navigation.navigate('SelfWakeVerification', {
                      recipientName: '지우',
                      photographer: 'jiwoo',
                    })
            }
            style={[
              styles.inviteActionButton,
              styles.inviteActionButtonActive,
              {
                left: 21 * scale,
                top: 373 * scale,
                width: 171 * scale,
                height: 44 * scale,
                borderRadius: 8 * scale,
              },
            ]}
          >
            <Text style={styles.inviteActionTextActive}>
              {isSelfScheduleRestricted ? '방해 금지' : '지금 인증할게요'}
            </Text>
          </TouchableOpacity>

          {wakeDemoState.aiFriendEnabled && (
            <>
              <View
                accessibilityLabel="AI 친구"
                style={[
                  styles.aiFriendCard,
                  {
                    left: 211 * scale,
                    top: 145 * scale,
                    width: 172 * scale,
                    height: 219 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              />
              <View
                style={[
                  styles.aiFriendButton,
                  {
                    left: 211 * scale,
                    top: 373 * scale,
                    width: 171 * scale,
                    height: 44 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              >
                <Text style={styles.aiFriendButtonText}>AI 친구</Text>
              </View>
            </>
          )}

          {emptySlots.map((slot, index) => (
            <React.Fragment key={`${slot.left}-${slot.top}`}>
              <View
                style={[
                  styles.inviteMemberCard,
                  styles.inviteEmptyCard,
                  {
                    left: slot.left * scale,
                    top: slot.top * scale,
                    width: 170 * scale,
                    height: 219 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`친구 ${index + 1} 초대하기`}
                activeOpacity={0.7}
                onPress={() => copyInviteCode().catch(() => undefined)}
                style={[
                  styles.inviteActionButton,
                  styles.inviteActionButtonInactive,
                  {
                    left: (slot.left - 1) * scale,
                    top: slot.buttonTop * scale,
                    width: 171 * scale,
                    height: 44 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              >
                <Text style={styles.inviteActionTextInactive}>
                  친구 초대하기
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          <Modal
            animationType="fade"
            onRequestClose={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: false }))
            }
            statusBarTranslucent
            transparent
            visible={wakeDemoState.menuVisible}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="그룹 메뉴 닫기"
              onPress={() =>
                setWakeDemoState(state => ({ ...state, menuVisible: false }))
              }
              style={styles.menuOverlay}
            >
              <Pressable
                onPress={event => event.stopPropagation()}
                style={[
                  styles.menuPanel,
                  {
                    right: Math.max(
                      (viewportWidth - contentWidth) / 2 + 28 * scale,
                      20,
                    ),
                    top: insets.top + 52 * scale,
                    width: 250 * scale,
                    height: 140 * scale,
                    borderRadius: 30 * scale,
                  },
                ]}
              >
                {['방 나가기', '초대 코드 복사하기', '방 이름 바꾸기'].map(
                  item => (
                    <TouchableOpacity
                      key={item}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                      onPress={
                        item === '방 나가기'
                          ? openLeaveConfirm
                          : item === '초대 코드 복사하기'
                          ? () => copyInviteCode().catch(() => undefined)
                          : undefined
                      }
                      style={styles.menuItem}
                    >
                      <Text style={styles.menuItemText}>{item}</Text>
                    </TouchableOpacity>
                  ),
                )}
              </Pressable>
            </Pressable>
          </Modal>
          <LeaveGroupConfirmModal
            onCancel={closeLeaveConfirm}
            onConfirm={() => leaveGroup().catch(() => undefined)}
            scale={scale}
            visible={wakeDemoState.leaveConfirmVisible}
          />
          <AiFriendConfirmModal
            onCancel={() => dismissAiFriendPrompt(false).catch(() => undefined)}
            onConfirm={() => dismissAiFriendPrompt(true).catch(() => undefined)}
            scale={scale}
            visible={wakeDemoState.aiFriendPromptVisible}
          />
          <InviteFriendBanner
            scale={scale}
            visible={wakeDemoState.inviteFriendBannerVisible}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (
    isMinjuViewer &&
    wakeDemoState.hasMinjuJoined &&
    !wakeDemoState.selfPhotoPath &&
    !wakeDemoState.minjuPhotoPath
  ) {
    const members = [
      { left: 21, name: '눈눈', remaining: '8시간 남음' },
      { left: 211, name: '지우', remaining: '0시간 남음' },
    ];
    const emptySlots = [23, 212];

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          backgroundColor={Colors.background}
          barStyle="dark-content"
        />
        <View style={[styles.container, { width: contentWidth }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="홈으로 이동"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() => navigation.popTo('Home')}
            style={[
              styles.headerIconButton,
              {
                left: 28 * scale,
                top: 9 * scale,
                width: 24 * scale,
                height: 24 * scale,
              },
            ]}
          >
            <Image
              source={require('../assets/images/chevron-left.png')}
              resizeMode="contain"
              style={styles.fullImage}
            />
          </TouchableOpacity>

          <Text style={[styles.groupTitle, { top: 20 * scale }]}>
            {route.params?.groupName || '아침야호'}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹 메뉴"
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: true }))
            }
            style={[
              styles.headerIconButton,
              {
                right: 27 * scale,
                top: 11 * scale,
                width: 20 * scale,
                height: 20 * scale,
              },
            ]}
          >
            <Image
              source={require('../assets/images/menu.png')}
              resizeMode="contain"
              style={styles.fullImage}
            />
          </TouchableOpacity>

          {members.map(member => {
            const isRestrictedMember =
              member.name === '눈눈' && isScheduleRestricted;

            return (
              <View
                key={member.name}
                style={[
                  styles.inviteMemberCard,
                  styles.inviteSelfCard,
                  isRestrictedMember && styles.scheduleRestrictedCard,
                  {
                    left: member.left * scale,
                    top: 145 * scale,
                    width: (member.left === 21 ? 172 : 170) * scale,
                    height: 219 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              >
                <View
                  style={[
                    styles.inviteMemberMeta,
                    { left: 11 * scale, top: 10 * scale },
                  ]}
                >
                  {isRestrictedMember ? (
                    <MemberStatusWhite width={17 * scale} height={16 * scale} />
                  ) : (
                    <MemberStatusLightGray
                      width={17 * scale}
                      height={16 * scale}
                    />
                  )}
                  <Text
                    style={[
                      styles.inviteMetaText,
                      isRestrictedMember && styles.memberNameOnPhoto,
                    ]}
                  >
                    {member.name}
                  </Text>
                  <View
                    style={[
                      styles.inviteMetaDot,
                      isRestrictedMember && styles.memberMetaDotOnPhoto,
                    ]}
                  />
                  <Text
                    style={[
                      styles.inviteMetaText,
                      isRestrictedMember && styles.memberNameOnPhoto,
                    ]}
                  >
                    {member.remaining}
                  </Text>
                </View>
                {isRestrictedMember ? (
                  <>
                    <Image
                      accessibilityLabel="수업 중"
                      resizeMode="contain"
                      source={require('../assets/images/class-in-progress-pen.png')}
                      style={[
                        styles.schedulePen,
                        {
                          left: 45 * scale,
                          top: 70 * scale,
                          width: 80 * scale,
                          height: 80 * scale,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.scheduleRestrictedText,
                        { top: 150 * scale },
                      ]}
                    >
                      수업 중이에요
                    </Text>
                  </>
                ) : (
                  <View
                    style={[
                      styles.inviteSleepDetails,
                      { left: 15 * scale, bottom: 17 * scale },
                    ]}
                  >
                    <View style={styles.sleepDetailColumn}>
                      <Text style={styles.inviteSleepValue}>09:03</Text>
                      <Text style={styles.inviteSleepLabel}>기상 시간</Text>
                    </View>
                    <View style={styles.sleepDetailColumn}>
                      <Text style={styles.inviteSleepValue}>1시간</Text>
                      <Text style={styles.inviteSleepLabel}>목표까지</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="눈눈 깨우기"
            accessibilityState={{
              disabled:
                wakeDemoState.hasJiwooWakeRequest || isScheduleRestricted,
            }}
            activeOpacity={
              wakeDemoState.hasJiwooWakeRequest || isScheduleRestricted
                ? 1
                : 0.8
            }
            disabled={wakeDemoState.hasJiwooWakeRequest || isScheduleRestricted}
            onPress={() =>
              setWakeDemoState(state => ({
                ...state,
                wakeConfirmVisible: true,
              }))
            }
            style={[
              styles.inviteActionButton,
              isScheduleRestricted
                ? styles.wakeCompletedButton
                : wakeDemoState.hasJiwooWakeRequest
                ? styles.wakeActionRequestedButton
                : styles.wakeActionButton,
              {
                left: 21 * scale,
                top: 373 * scale,
                width: 171 * scale,
                height: 44 * scale,
                borderRadius: 8 * scale,
              },
            ]}
          >
            <Text
              style={
                wakeDemoState.hasJiwooWakeRequest
                  ? styles.wakeActionRequestedText
                  : styles.inviteActionTextActive
              }
            >
              {isScheduleRestricted
                ? '10시 이후 깨우기 가능'
                : wakeDemoState.hasJiwooWakeRequest
                ? '28:20'
                : '깨우기'}
            </Text>
          </TouchableOpacity>

          <Modal
            animationType="fade"
            onRequestClose={() =>
              setWakeDemoState(state => ({
                ...state,
                wakeConfirmVisible: false,
              }))
            }
            statusBarTranslucent
            transparent
            visible={wakeDemoState.wakeConfirmVisible}
          >
            <View style={styles.wakeConfirmOverlay}>
              <View
                style={[
                  styles.wakeConfirmPanel,
                  {
                    width: 320 * scale,
                    height: 315 * scale,
                    borderRadius: 16 * scale,
                  },
                ]}
              >
                <Image
                  accessibilityLabel="주의"
                  resizeMode="contain"
                  source={require('../assets/images/wake-caution.png')}
                  style={[
                    styles.wakeConfirmIcon,
                    { width: 104 * scale, height: 104 * scale },
                  ]}
                />
                <Text style={styles.wakeConfirmTitle}>눈눈님을 깨울까요?</Text>
                <Text style={styles.wakeConfirmDescription}>
                  코드를 입력하면 그룹에 참여할 수 있어요
                </Text>
                <View style={styles.wakeConfirmActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="안 깨울래요"
                    activeOpacity={0.8}
                    onPress={() =>
                      setWakeDemoState(state => ({
                        ...state,
                        wakeConfirmVisible: false,
                      }))
                    }
                    style={[
                      styles.wakeConfirmButton,
                      styles.wakeConfirmCancelButton,
                    ]}
                  >
                    <Text style={styles.wakeConfirmCancelText}>
                      안 깨울래요
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="깨울게요"
                    activeOpacity={0.8}
                    onPress={() => wakeJiwoo().catch(() => undefined)}
                    style={[
                      styles.wakeConfirmButton,
                      styles.wakeConfirmAcceptButton,
                    ]}
                  >
                    <Text style={styles.wakeConfirmAcceptText}>깨울게요</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isSelfScheduleRestricted ? '방해 금지' : '지금 인증할게요'
            }
            activeOpacity={isSelfScheduleRestricted ? 1 : 0.8}
            disabled={isSelfScheduleRestricted}
            onPress={
              isSelfScheduleRestricted
                ? undefined
                : () =>
                    navigation.navigate('SelfWakeVerification', {
                      recipientName: '눈눈',
                      photographer: 'minju',
                    })
            }
            style={[
              styles.inviteActionButton,
              styles.inviteActionButtonActive,
              {
                left: 210 * scale,
                top: 373 * scale,
                width: 171 * scale,
                height: 44 * scale,
                borderRadius: 8 * scale,
              },
            ]}
          >
            <Text style={styles.inviteActionTextActive}>
              {isSelfScheduleRestricted ? '방해 금지' : '지금 인증할게요'}
            </Text>
          </TouchableOpacity>

          {emptySlots.map((left, index) => (
            <React.Fragment key={left}>
              <View
                style={[
                  styles.inviteMemberCard,
                  styles.inviteEmptyCard,
                  {
                    left: left * scale,
                    top: 435 * scale,
                    width: 170 * scale,
                    height: 219 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`친구 ${index + 1} 초대하기`}
                activeOpacity={0.7}
                onPress={() => copyInviteCode().catch(() => undefined)}
                style={[
                  styles.inviteActionButton,
                  styles.inviteActionButtonInactive,
                  {
                    left: (left - 1) * scale,
                    top: 663 * scale,
                    width: 171 * scale,
                    height: 44 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              >
                <Text style={styles.inviteActionTextInactive}>
                  친구 초대하기
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          <Modal
            animationType="fade"
            onRequestClose={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: false }))
            }
            statusBarTranslucent
            transparent
            visible={wakeDemoState.menuVisible}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="그룹 메뉴 닫기"
              onPress={() =>
                setWakeDemoState(state => ({ ...state, menuVisible: false }))
              }
              style={styles.menuOverlay}
            >
              <Pressable
                onPress={event => event.stopPropagation()}
                style={[
                  styles.menuPanel,
                  {
                    right: Math.max(
                      (viewportWidth - contentWidth) / 2 + 28 * scale,
                      20,
                    ),
                    top: insets.top + 52 * scale,
                    width: 250 * scale,
                    height: 140 * scale,
                    borderRadius: 30 * scale,
                  },
                ]}
              >
                {['방 나가기', '초대 코드 복사하기', '방 이름 바꾸기'].map(
                  item => (
                    <TouchableOpacity
                      key={item}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                      onPress={
                        item === '방 나가기'
                          ? openLeaveConfirm
                          : item === '초대 코드 복사하기'
                          ? () => copyInviteCode().catch(() => undefined)
                          : undefined
                      }
                      style={styles.menuItem}
                    >
                      <Text style={styles.menuItemText}>{item}</Text>
                    </TouchableOpacity>
                  ),
                )}
              </Pressable>
            </Pressable>
          </Modal>
          <LeaveGroupConfirmModal
            onCancel={closeLeaveConfirm}
            onConfirm={() => leaveGroup().catch(() => undefined)}
            scale={scale}
            visible={wakeDemoState.leaveConfirmVisible}
          />
          <AiFriendConfirmModal
            onCancel={() => dismissAiFriendPrompt(false).catch(() => undefined)}
            onConfirm={() => dismissAiFriendPrompt(true).catch(() => undefined)}
            scale={scale}
            visible={wakeDemoState.aiFriendPromptVisible}
          />
          <InviteFriendBanner
            scale={scale}
            visible={wakeDemoState.inviteFriendBannerVisible}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />
      <View style={[styles.container, { width: contentWidth }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="이전 화면으로 이동"
          activeOpacity={0.7}
          hitSlop={12}
          onPress={() => navigation.popTo('Home')}
          style={[
            styles.headerIconButton,
            {
              left: 28 * scale,
              top: 9 * scale,
              width: 24 * scale,
              height: 24 * scale,
            },
          ]}
        >
          <Image
            source={require('../assets/images/chevron-left.png')}
            resizeMode="contain"
            style={styles.fullImage}
          />
        </TouchableOpacity>

        <Text style={[styles.groupTitle, { top: 20 * scale }]}>
          {route.params?.groupName || '아침 야호'}
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="그룹 메뉴"
          activeOpacity={0.7}
          hitSlop={12}
          onPress={() =>
            setWakeDemoState(state => ({ ...state, menuVisible: true }))
          }
          style={[
            styles.headerIconButton,
            {
              right: 27 * scale,
              top: 11 * scale,
              width: 20 * scale,
              height: 20 * scale,
            },
          ]}
        >
          <Image
            source={require('../assets/images/menu.png')}
            resizeMode="contain"
            style={styles.fullImage}
          />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            firstMemberPhotoPath
              ? `${isMinjuViewer ? '지우' : '눈눈'} 인증사진 확대`
              : !isMinjuViewer
              ? '눈눈 인증사진 촬영'
              : '지우'
          }
          activeOpacity={
            firstMemberPhotoPath ||
            (!isMinjuViewer && !wakeDemoState.hasJiwooWakeExhausted)
              ? 0.85
              : 1
          }
          onPress={
            firstMemberPhotoPath
              ? () =>
                  setWakeDemoState(state => ({
                    ...state,
                    expandedPhoto: {
                      path: firstMemberPhotoPath,
                      memberName: isMinjuViewer ? '지우' : '눈눈',
                    },
                  }))
              : !isMinjuViewer && !wakeDemoState.hasJiwooWakeExhausted
              ? () =>
                  navigation.navigate('CameraCapture', {
                    recipientName: '지우',
                    photographer: 'jiwoo',
                  })
              : undefined
          }
          style={[
            styles.waitingMemberCard,
            wakeDemoState.hasJiwooWakeExhausted &&
              !isMinjuViewer &&
              styles.helpNeededCard,
            {
              left: 21 * scale,
              top: 145 * scale,
              width: 172 * scale,
              height: 219 * scale,
              borderRadius: 8 * scale,
            },
          ]}
        >
          {firstMemberPhotoPath && (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: `file://${firstMemberPhotoPath}` }}
              style={styles.memberPhoto}
            />
          )}
          {wakeDemoState.hasJiwooWakeExhausted && !isMinjuViewer && (
            <>
              <Image
                accessibilityLabel="도움이 필요해요"
                resizeMode="contain"
                source={require('../assets/images/wake-help-fire.png')}
                style={[
                  styles.helpFire,
                  {
                    left: 35 * scale,
                    top: 48 * scale,
                    width: 80 * scale,
                    height: 80 * scale,
                  },
                ]}
              />
              <Text style={[styles.helpNeededText, { top: 128 * scale }]}>
                도움이 필요해요!
              </Text>
            </>
          )}
          {isMinjuViewer &&
            wakeDemoState.hasMinjuWakeRequest &&
            !firstMemberPhotoPath && (
              <Image
                accessibilityLabel="눈눈에게 받은 깨우기 알림"
                resizeMode="contain"
                source={require('../assets/images/wake-alarm.png')}
                style={[
                  styles.wakeAlarm,
                  {
                    width: 28 * scale,
                    height: 28 * scale,
                    top: 95 * scale,
                  },
                ]}
              />
            )}
          <View
            style={[
              styles.memberIdentity,
              { left: 9 * scale, top: 9 * scale, columnGap: 3 * scale },
            ]}
          >
            {(wakeDemoState.hasJiwooWakeExhausted && !isMinjuViewer) ||
            firstMemberPhotoPath ? (
              <MemberStatusWhite width={16.78 * scale} height={16 * scale} />
            ) : (
              <MemberStatusLightGray
                width={16.78 * scale}
                height={16 * scale}
              />
            )}
            <Text
              style={[
                styles.memberName,
                (firstMemberPhotoPath || wakeDemoState.hasJiwooWakeExhausted) &&
                  styles.memberNameOnPhoto,
              ]}
            >
              {isMinjuViewer ? '지우' : '눈눈'}
            </Text>
            <View
              style={[
                styles.memberMetaDot,
                (firstMemberPhotoPath || wakeDemoState.hasJiwooWakeExhausted) &&
                  styles.memberMetaDotOnPhoto,
              ]}
            />
            <Text
              style={[
                styles.memberName,
                (firstMemberPhotoPath || wakeDemoState.hasJiwooWakeExhausted) &&
                  styles.memberNameOnPhoto,
              ]}
            >
              8시간 남음
            </Text>
          </View>
          <View
            style={[
              styles.sleepDetails,
              { left: 27 * scale, bottom: 17 * scale },
            ]}
          >
            <View style={styles.sleepDetailColumn}>
              <Text
                style={[
                  styles.sleepValue,
                  (firstMemberPhotoPath ||
                    wakeDemoState.hasJiwooWakeExhausted) &&
                    styles.awakeDetailText,
                ]}
              >
                {wakeDemoState.hasJiwooWakeExhausted && !isMinjuViewer
                  ? '09:03'
                  : firstMemberPhotoPath
                  ? isMinjuViewer
                    ? '09:33'
                    : '09:03'
                  : '07:32'}
              </Text>
              <Text
                style={[
                  styles.sleepLabel,
                  (firstMemberPhotoPath ||
                    wakeDemoState.hasJiwooWakeExhausted) &&
                    styles.awakeDetailText,
                ]}
              >
                {firstMemberPhotoPath || wakeDemoState.hasJiwooWakeExhausted
                  ? '기상 시간'
                  : '기상 목표'}
              </Text>
            </View>
            <View style={styles.sleepDetailColumn}>
              <Text
                style={[
                  styles.sleepValue,
                  (firstMemberPhotoPath ||
                    wakeDemoState.hasJiwooWakeExhausted) &&
                    styles.awakeDetailText,
                ]}
              >
                {wakeDemoState.hasJiwooWakeExhausted && !isMinjuViewer
                  ? '3시간 경과'
                  : firstMemberPhotoPath
                  ? isMinjuViewer
                    ? '01분 째'
                    : '5시간째'
                  : '4시간째'}
              </Text>
              <Text
                style={[
                  styles.sleepLabel,
                  (firstMemberPhotoPath ||
                    wakeDemoState.hasJiwooWakeExhausted) &&
                    styles.awakeDetailText,
                ]}
              >
                {wakeDemoState.hasJiwooWakeExhausted && !isMinjuViewer
                  ? '목표로부터'
                  : firstMemberPhotoPath
                  ? '기상 중'
                  : '취침 중'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            wakeDemoState.hasMinjuJoined
              ? `${isMinjuViewer ? '눈눈' : '지우'} 멤버`
              : `${isMinjuViewer ? '눈눈' : '지우'} 참여 상태로 전환`
          }
          activeOpacity={secondMemberPhotoPath ? 0.85 : 1}
          onPress={() => {
            if (wakeDemoState.aiFriendEnabled) {
              return;
            }

            if (secondMemberPhotoPath && !isScheduleRestricted) {
              setWakeDemoState(state => ({
                ...state,
                expandedPhoto: {
                  path: secondMemberPhotoPath,
                  memberName: isMinjuViewer ? '눈눈' : '지우',
                },
              }));
              return;
            }

            setWakeDemoState(state => ({
              ...state,
              hasMinjuJoined: true,
            }));
          }}
          style={[
            styles.waitingMemberCard,
            !wakeDemoState.hasMinjuJoined &&
              !wakeDemoState.aiFriendEnabled &&
              styles.inviteEmptyCard,
            wakeDemoState.aiFriendEnabled && styles.aiFriendCard,
            isScheduleRestricted && styles.scheduleRestrictedCard,
            {
              left: 211 * scale,
              top: 145 * scale,
              width: 170 * scale,
              height: 219 * scale,
              borderRadius: 8 * scale,
            },
          ]}
        >
          {wakeDemoState.hasMinjuJoined ? (
            <>
              {secondMemberPhotoPath && !isScheduleRestricted && (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${
                    isMinjuViewer ? '눈눈' : '지우'
                  }가 올린 인증사진`}
                  resizeMode="cover"
                  source={{ uri: `file://${secondMemberPhotoPath}` }}
                  style={styles.memberPhoto}
                />
              )}
              {!isMinjuViewer &&
                wakeDemoState.hasMinjuWakeRequest &&
                !isScheduleRestricted && (
                  <Image
                    accessibilityLabel="지우에게 깨우기 알림 전송됨"
                    resizeMode="contain"
                    source={require('../assets/images/wake-alarm.png')}
                    style={[
                      styles.wakeAlarm,
                      {
                        width: 28 * scale,
                        height: 28 * scale,
                        top: 95 * scale,
                      },
                    ]}
                  />
                )}
              {isScheduleRestricted && (
                <>
                  <Image
                    accessibilityLabel="수업 중"
                    resizeMode="contain"
                    source={require('../assets/images/class-in-progress-pen.png')}
                    style={[
                      styles.schedulePen,
                      {
                        left: 45 * scale,
                        top: 70 * scale,
                        width: 80 * scale,
                        height: 80 * scale,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.scheduleRestrictedText,
                      { top: 150 * scale },
                    ]}
                  >
                    수업 중이에요
                  </Text>
                </>
              )}
              <View
                style={[
                  styles.memberIdentity,
                  { left: 9 * scale, top: 9 * scale, columnGap: 3 * scale },
                ]}
              >
                {secondMemberPhotoPath || isScheduleRestricted ? (
                  <MemberStatusWhite
                    width={16.78 * scale}
                    height={16 * scale}
                  />
                ) : (
                  <MemberStatusLightGray
                    width={16.78 * scale}
                    height={16 * scale}
                  />
                )}
                <Text
                  style={[
                    styles.memberName,
                    isScheduleRestricted && styles.memberNameOnPhoto,
                  ]}
                >
                  {isMinjuViewer ? '눈눈' : '지우'}
                </Text>
                <View
                  style={[
                    styles.memberMetaDot,
                    isScheduleRestricted && styles.memberMetaDotOnPhoto,
                  ]}
                />
                <Text
                  style={[
                    styles.memberName,
                    isScheduleRestricted && styles.memberNameOnPhoto,
                  ]}
                >
                  0시간 남음
                </Text>
              </View>
              {!isScheduleRestricted && (
                <View
                  style={[
                    styles.sleepDetails,
                    { left: 27 * scale, bottom: 17 * scale },
                  ]}
                >
                  <View style={styles.sleepDetailColumn}>
                    <Text
                      style={[
                        styles.sleepValue,
                        secondMemberPhotoPath && styles.awakeDetailText,
                      ]}
                    >
                      {secondMemberPhotoPath
                        ? isMinjuViewer
                          ? '09:03'
                          : '09:33'
                        : '07:32'}
                    </Text>
                    <Text
                      style={[
                        styles.sleepLabel,
                        secondMemberPhotoPath && styles.awakeDetailText,
                      ]}
                    >
                      {secondMemberPhotoPath ? '기상 시간' : '기상 목표'}
                    </Text>
                  </View>
                  <View style={styles.sleepDetailColumn}>
                    <Text
                      style={[
                        styles.sleepValue,
                        secondMemberPhotoPath && styles.awakeDetailText,
                      ]}
                    >
                      {secondMemberPhotoPath
                        ? isMinjuViewer
                          ? '23분 째'
                          : '01분 째'
                        : '4시간째'}
                    </Text>
                    <Text
                      style={[
                        styles.sleepLabel,
                        secondMemberPhotoPath && styles.awakeDetailText,
                      ]}
                    >
                      {secondMemberPhotoPath ? '기상 중' : '취침 중'}
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : null}
        </TouchableOpacity>

        <View
          style={[
            styles.memberActionRow,
            {
              left: 21 * scale,
              top: 373 * scale,
              columnGap: 18 * scale,
            },
          ]}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isSelfScheduleRestricted ? '방해 금지' : '지금 인증할게요'
            }
            activeOpacity={isSelfScheduleRestricted ? 1 : 0.8}
            disabled={isSelfScheduleRestricted}
            onPress={
              isSelfScheduleRestricted
                ? undefined
                : () =>
                    navigation.navigate('SelfWakeVerification', {
                      recipientName: isMinjuViewer ? '눈눈' : '지우',
                      photographer: isMinjuViewer ? 'minju' : 'jiwoo',
                    })
            }
            style={[
              styles.memberActionButton,
              isSelfScheduleRestricted
                ? styles.wakeCompletedButton
                : styles.wakeActionButton,
              {
                width: 171 * scale,
                height: 44 * scale,
                borderRadius: 8 * scale,
              },
            ]}
          >
            <Text style={styles.selfAwakeButtonText}>
              {isSelfScheduleRestricted ? '방해 금지' : '지금 인증할게요'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              !wakeDemoState.hasMinjuJoined && !wakeDemoState.aiFriendEnabled
                ? '친구 초대하기'
                : undefined
            }
            accessibilityState={{
              disabled:
                wakeDemoState.aiFriendEnabled ||
                (wakeDemoState.hasMinjuJoined &&
                  (isWakeCompleted || isScheduleRestricted)),
            }}
            activeOpacity={
              !wakeDemoState.aiFriendEnabled &&
              (!wakeDemoState.hasMinjuJoined ||
                (!isWakeCompleted && !isScheduleRestricted))
                ? 0.8
                : 1
            }
            disabled={
              wakeDemoState.aiFriendEnabled ||
              (wakeDemoState.hasMinjuJoined &&
                (isWakeCompleted || isScheduleRestricted))
            }
            onPress={
              !wakeDemoState.hasMinjuJoined
                ? () => copyInviteCode().catch(() => undefined)
                : secondMemberPhotoPath
                ? () =>
                    setWakeDemoState(state => ({
                      ...state,
                      wakeLockedVisible: true,
                    }))
                : !isMinjuViewer && !isWakeCompleted && !isScheduleRestricted
                ? () => wakeMinju().catch(() => undefined)
                : undefined
            }
            style={[
              styles.memberActionButton,
              wakeDemoState.aiFriendEnabled
                ? styles.aiFriendButtonFill
                : !wakeDemoState.hasMinjuJoined
                ? styles.inviteActionButtonInactive
                : isWakeCompleted
                ? styles.wakeCompletedButton
                : isScheduleRestricted
                ? styles.wakeCompletedButton
                : isJiwooBaseState
                ? styles.wakeActionButton
                : (wakeDemoState.hasMinjuWakeRequest && !isMinjuViewer) ||
                  secondMemberPhotoPath
                ? styles.wakeRequestedButton
                : wakeDemoState.hasMinjuJoined
                ? styles.selfAwakeButton
                : styles.waitingWakeButton,
              {
                width: 171 * scale,
                height: 44 * scale,
                borderRadius: 8 * scale,
              },
            ]}
          >
            <Text
              style={
                !wakeDemoState.hasMinjuJoined && !wakeDemoState.aiFriendEnabled
                  ? styles.inviteActionTextInactive
                  : [
                      styles.waitingWakeButtonText,
                      wakeDemoState.aiFriendEnabled &&
                        styles.aiFriendButtonText,
                      wakeDemoState.hasMinjuWakeRequest &&
                        !isMinjuViewer &&
                        styles.wakeRequestedButtonText,
                      secondMemberPhotoPath && styles.wakeRequestedButtonText,
                      isWakeCompleted && styles.wakeCompletedButtonText,
                      isScheduleRestricted && styles.wakeCompletedButtonText,
                    ]
              }
            >
              {wakeDemoState.aiFriendEnabled
                ? 'AI 친구'
                : !wakeDemoState.hasMinjuJoined
                ? '친구 초대하기'
                : isScheduleRestricted
                ? '10시 이후 깨우기 가능'
                : isWakeCompleted
                ? '기상 완료'
                : secondMemberPhotoPath
                ? '06 : 20'
                : bothMembersAwake
                ? isMinjuViewer
                  ? '05 : 20'
                  : '30 : 00'
                : wakeDemoState.hasMinjuWakeRequest && !isMinjuViewer
                ? '28 : 20'
                : '깨우기'}
            </Text>
          </TouchableOpacity>
        </View>

        <Modal
          animationType="fade"
          onRequestClose={() => clearWakeSuccess().catch(() => undefined)}
          statusBarTranslucent
          transparent
          visible={wakeDemoState.wakeSuccessVisible}
        >
          <View style={styles.wakeConfirmOverlay}>
            <View
              style={[
                styles.wakeSuccessPanel,
                {
                  width: 320 * scale,
                  height: 315 * scale,
                  borderRadius: 24 * scale,
                },
              ]}
            >
              <Image
                accessibilityLabel="깨우기 성공"
                resizeMode="contain"
                source={require('../assets/images/wake-success-clock.png')}
                style={{ width: 104 * scale, height: 104 * scale }}
              />
              <Text style={styles.wakeSuccessTitle}>눈눈님 깨우기 성공!</Text>
              <Text style={styles.wakeSuccessDescription}>
                오늘의 리워드를 보내볼까요?
              </Text>
              <View style={styles.wakeSuccessActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="리워드 나중에 보내기"
                  activeOpacity={0.8}
                  onPress={() => clearWakeSuccess().catch(() => undefined)}
                  style={[
                    styles.wakeSuccessButton,
                    styles.wakeSuccessLaterButton,
                  ]}
                >
                  <Text style={styles.wakeSuccessLaterText}>나중에</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="리워드 보내기"
                  activeOpacity={0.8}
                  onPress={() => openRewardList().catch(() => undefined)}
                  style={[
                    styles.wakeSuccessButton,
                    styles.wakeSuccessSendButton,
                  ]}
                >
                  <Text style={styles.wakeSuccessSendText}>보내기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          onRequestClose={() =>
            setWakeDemoState(state => ({
              ...state,
              wakeLockedVisible: false,
            }))
          }
          statusBarTranslucent
          transparent
          visible={wakeDemoState.wakeLockedVisible}
        >
          <View style={styles.wakeConfirmOverlay}>
            <View
              style={[
                styles.wakeLockedPanel,
                {
                  width: 320 * scale,
                  height: 315 * scale,
                  borderRadius: 16 * scale,
                },
              ]}
            >
              <Image
                accessibilityLabel="깨우기 대기 안내"
                resizeMode="contain"
                source={require('../assets/images/wake-caution.png')}
                style={{ width: 104 * scale, height: 104 * scale }}
              />
              <Text style={styles.wakeLockedTitle}>
                23분 30초 후 깨울 수 있어요
              </Text>
              <Text style={styles.wakeLockedDescription}>
                코드를 입력하면 그룹에 참여할 수 있어요
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="깨우기 대기 안내 확인"
                activeOpacity={0.8}
                onPress={() =>
                  setWakeDemoState(state => ({
                    ...state,
                    wakeLockedVisible: false,
                  }))
                }
                style={[
                  styles.wakeLockedConfirmButton,
                  {
                    width: 246 * scale,
                    height: 44 * scale,
                    borderRadius: 8 * scale,
                  },
                ]}
              >
                <Text style={styles.wakeLockedConfirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {[23, 212].map((left, index) => (
          <React.Fragment key={left}>
            <View
              style={[
                styles.inviteMemberCard,
                styles.inviteEmptyCard,
                {
                  left: left * scale,
                  top: 435 * scale,
                  width: 170 * scale,
                  height: 219 * scale,
                  borderRadius: 8 * scale,
                },
              ]}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`친구 ${index + 1} 초대하기`}
              activeOpacity={0.7}
              onPress={() => copyInviteCode().catch(() => undefined)}
              style={[
                styles.inviteActionButton,
                styles.inviteActionButtonInactive,
                {
                  left: (left - 1) * scale,
                  top: 663 * scale,
                  width: 171 * scale,
                  height: 44 * scale,
                  borderRadius: 8 * scale,
                },
              ]}
            >
              <Text style={styles.inviteActionTextInactive}>친구 초대하기</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}

        <Modal
          animationType="fade"
          onRequestClose={() =>
            setWakeDemoState(state => ({ ...state, menuVisible: false }))
          }
          statusBarTranslucent
          transparent
          visible={wakeDemoState.menuVisible}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="그룹 메뉴 닫기"
            onPress={() =>
              setWakeDemoState(state => ({ ...state, menuVisible: false }))
            }
            style={styles.menuOverlay}
          >
            <Pressable
              onPress={event => event.stopPropagation()}
              style={[
                styles.menuPanel,
                {
                  right: Math.max(
                    (viewportWidth - contentWidth) / 2 + 28 * scale,
                    20,
                  ),
                  top: insets.top + 52 * scale,
                  width: 250 * scale,
                  height: 140 * scale,
                  borderRadius: 30 * scale,
                },
              ]}
            >
              {['방 나가기', '초대 코드 복사하기', '방 이름 바꾸기'].map(
                item => (
                  <TouchableOpacity
                    key={item}
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    onPress={
                      item === '방 나가기'
                        ? openLeaveConfirm
                        : item === '초대 코드 복사하기'
                        ? () => copyInviteCode().catch(() => undefined)
                        : undefined
                    }
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>{item}</Text>
                  </TouchableOpacity>
                ),
              )}
            </Pressable>
          </Pressable>
        </Modal>
        <LeaveGroupConfirmModal
          onCancel={closeLeaveConfirm}
          onConfirm={() => leaveGroup().catch(() => undefined)}
          scale={scale}
          visible={wakeDemoState.leaveConfirmVisible}
        />
        <AiFriendConfirmModal
          onCancel={() => dismissAiFriendPrompt(false).catch(() => undefined)}
          onConfirm={() => dismissAiFriendPrompt(true).catch(() => undefined)}
          scale={scale}
          visible={wakeDemoState.aiFriendPromptVisible}
        />
        <InviteFriendBanner
          scale={scale}
          visible={wakeDemoState.inviteFriendBannerVisible}
        />
      </View>
    </SafeAreaView>
  );
};

type BackendWakeGroupDetailProps = {
  detail: WakeGroupDetail | null;
  error: string | null;
  fallbackName?: string;
  loading: boolean;
  onBack: () => void;
  onLeave: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onSelfVerify: () => void;
  onWake: (receiverId: number) => Promise<void>;
  scale: number;
  width: number;
};

const memberPositions = [
  { left: 21, top: 145 },
  { left: 211, top: 145 },
  { left: 21, top: 435 },
  { left: 211, top: 435 },
] as const;

const remainingText = (member: WakeGroupMember) => {
  if (member.remaining_to_target) {
    const unit = member.remaining_to_target.unit === 'HOUR' ? '시간' : '분';
    return `${member.remaining_to_target.value}${unit} 남음`;
  }
  if (member.state === 'AWAKE') {
    return '기상 완료';
  }
  return member.target_wake_time
    ? `${formatTime(member.target_wake_time)} 목표`
    : '목표 없음';
};

const stateText = (member: WakeGroupMember) => {
  switch (member.state) {
    case 'AWAKE':
      return '기상 완료';
    case 'SLEEPING':
      return '수면 중';
    case 'NEEDS_HELP':
      return '도움 필요';
    default:
      return '기상 전';
  }
};

const actionText = (member: WakeGroupMember) => {
  if (member.is_me) {
    return member.state === 'AWAKE' ? '기상 완료' : '지금 인증할게요';
  }
  if (member.can_wake) {
    return '깨우기';
  }
  return member.block_reason === 'DND' ? '방해 금지 중' : '깨우기 대기 중';
};

const wakeRequestErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return '깨우기 요청을 보내지 못했어요.';
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
    case 'INVALID_JWT':
    case 'EXPIRED_JWT':
      return '데모 사용자를 다시 선택해주세요.';
    case 'WAKE_GROUP_SENDER_NOT_MEMBER':
    case 'FORBIDDEN':
      return '깨우기 요청 권한이 없어요.';
    case 'WAKE_GROUP_NOT_FOUND':
    case 'WAKE_GROUP_RECEIVER_NOT_MEMBER':
    case 'USER_NOT_FOUND':
      return '그룹 또는 멤버를 찾을 수 없어요.';
    case 'CANNOT_WAKE_SELF':
      return '본인은 깨울 수 없어요.';
    case 'WAKE_BLOCKED_DND':
      return '현재 방해 금지 상태라 깨울 수 없어요.';
    case 'WAKE_COOLDOWN':
      return '최근 인증 후 30분 동안은 깨울 수 없어요.';
    case 'ACTIVE_POSE_NOT_FOUND':
      return '오늘의 인증 포즈가 준비되지 않았어요.';
    default:
      return '깨우기 요청을 보내지 못했어요.';
  }
};

const leaveGroupErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return '그룹에서 나가지 못했어요.';
  }

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
  if (!(error instanceof ApiError)) {
    return '그룹 이름을 변경하지 못했어요.';
  }

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

const BackendWakeGroupDetail = ({
  detail,
  error,
  fallbackName,
  loading,
  onBack,
  onLeave,
  onRename,
  onSelfVerify,
  onWake,
  scale,
  width,
}: BackendWakeGroupDetailProps) => {
  const [selectedMember, setSelectedMember] = useState<WakeGroupMember | null>(
    null,
  );
  const [wakingReceiverId, setWakingReceiverId] = useState<number | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const renameInFlightRef = useRef(false);
  const leaveInFlightRef = useRef(false);
  const slots = Array.from({ length: detail?.capacity ?? 0 }, (_, index) => ({
    member: detail?.members[index] ?? null,
    position: memberPositions[index],
  })).filter(slot => slot.position);

  const confirmWake = async () => {
    if (
      !selectedMember ||
      selectedMember.is_me ||
      !selectedMember.can_wake ||
      wakingReceiverId !== null
    ) {
      return;
    }

    const receiver = selectedMember;
    setWakingReceiverId(receiver.user_id);
    try {
      await onWake(receiver.user_id);
      setSelectedMember(null);
      Alert.alert(
        '요청 완료',
        `${receiver.nickname}님에게 깨우기 요청을 보냈어요.`,
      );
    } catch (wakeError) {
      Alert.alert('깨우기 실패', wakeRequestErrorMessage(wakeError));
    } finally {
      setWakingReceiverId(null);
    }
  };

  const confirmLeave = async () => {
    if (leaveInFlightRef.current) {
      return;
    }

    leaveInFlightRef.current = true;
    setLeaving(true);
    try {
      await onLeave();
    } catch (leaveError) {
      Alert.alert('그룹 탈퇴 실패', leaveGroupErrorMessage(leaveError));
    } finally {
      leaveInFlightRef.current = false;
      setLeaving(false);
    }
  };

  const confirmRename = async () => {
    const nextName = renameInput.trim();
    if (!nextName || nextName.length > 50 || renameInFlightRef.current) {
      return;
    }

    renameInFlightRef.current = true;
    setRenaming(true);
    try {
      await onRename(nextName);
      setRenameVisible(false);
    } catch (renameError) {
      Alert.alert('이름 변경 실패', renameGroupErrorMessage(renameError));
    } finally {
      renameInFlightRef.current = false;
      setRenaming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />
      <View style={[styles.container, { width }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="홈으로 이동"
          activeOpacity={0.7}
          hitSlop={12}
          onPress={onBack}
          style={[
            styles.headerIconButton,
            {
              left: 28 * scale,
              top: 9 * scale,
              width: 24 * scale,
              height: 24 * scale,
            },
          ]}
        >
          <Image
            resizeMode="contain"
            source={require('../assets/images/chevron-left.png')}
            style={styles.fullImage}
          />
        </TouchableOpacity>
        <Text style={[styles.groupTitle, { top: 20 * scale }]}>
          {detail?.name || fallbackName || 'Wake Group'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="그룹 메뉴"
          activeOpacity={0.7}
          hitSlop={12}
          onPress={() => setMenuVisible(true)}
          style={[
            styles.headerIconButton,
            {
              right: 27 * scale,
              top: 11 * scale,
              width: 20 * scale,
              height: 20 * scale,
            },
          ]}
        >
          <Image
            resizeMode="contain"
            source={require('../assets/images/menu.png')}
            style={styles.fullImage}
          />
        </TouchableOpacity>

        {loading && (
          <View style={styles.groupDetailState}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        )}
        {!loading && error && (
          <View style={styles.groupDetailState}>
            <Text
              accessibilityLiveRegion="polite"
              style={styles.groupDetailStateText}
            >
              {error}
            </Text>
          </View>
        )}
        {!loading && detail && (
          <>
            <Text style={[styles.groupMemberCount, { top: 55 * scale }]}>
              {detail.current_members}/{detail.capacity}명
            </Text>
            {slots.map(({ member, position }, index) => (
              <React.Fragment key={member?.user_id ?? `empty-${index}`}>
                <View
                  style={[
                    styles.fullCapacityMemberCard,
                    {
                      left: position.left * scale,
                      top: position.top * scale,
                      width: (position.left === 21 ? 172 : 170) * scale,
                      height: 219 * scale,
                      borderRadius: 8 * scale,
                    },
                  ]}
                >
                  {member?.proof_image_url && (
                    <Image
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={`${member.nickname} 인증사진`}
                      resizeMode="cover"
                      source={{ uri: member.proof_image_url }}
                      style={styles.memberPhoto}
                    />
                  )}
                  <View
                    style={[
                      styles.memberIdentity,
                      { left: 9 * scale, top: 9 * scale, columnGap: 3 * scale },
                    ]}
                  >
                    {member?.proof_image_url ? (
                      <MemberStatusWhite
                        width={16.78 * scale}
                        height={16 * scale}
                      />
                    ) : (
                      <MemberStatusLightGray
                        width={16.78 * scale}
                        height={16 * scale}
                      />
                    )}
                    <Text
                      style={[
                        styles.memberName,
                        member?.proof_image_url && styles.memberNameOnPhoto,
                      ]}
                    >
                      {member?.nickname ?? '빈 자리'}
                    </Text>
                    {member && <View style={styles.memberMetaDot} />}
                    {member && (
                      <Text
                        style={[
                          styles.memberName,
                          member.proof_image_url && styles.memberNameOnPhoto,
                        ]}
                      >
                        {remainingText(member)}
                      </Text>
                    )}
                  </View>
                  {member && (
                    <View
                      style={[
                        styles.fullCapacitySleepDetails,
                        { bottom: 17 * scale },
                      ]}
                    >
                      <View
                        style={[
                          styles.fullCapacityFirstDetailColumn,
                          { width: 86 * scale },
                        ]}
                      >
                        <Text style={styles.fullCapacityDetailValue}>
                          {member.actual_wake_time
                            ? formatTime(member.actual_wake_time)
                            : member.target_wake_time
                            ? formatTime(member.target_wake_time)
                            : '--:--'}
                        </Text>
                        <Text style={styles.fullCapacityDetailLabel}>
                          {member.actual_wake_time ? '기상 시간' : '기상 목표'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.fullCapacitySecondDetailColumn,
                          { width: 86 * scale },
                        ]}
                      >
                        <Text style={styles.fullCapacityDetailValue}>
                          {stateText(member)}
                        </Text>
                        <Text style={styles.fullCapacityDetailLabel}>
                          현재 상태
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    member ? actionText(member) : '친구 초대하기'
                  }
                  accessibilityState={{
                    disabled:
                      !member ||
                      (member.is_me
                        ? member.state === 'AWAKE'
                        : !member.can_wake) ||
                      wakingReceiverId !== null,
                  }}
                  activeOpacity={
                    member &&
                    (member.is_me
                      ? member.state !== 'AWAKE'
                      : member.can_wake) &&
                    wakingReceiverId === null
                      ? 0.8
                      : 1
                  }
                  disabled={
                    !member ||
                    (member.is_me
                      ? member.state === 'AWAKE'
                      : !member.can_wake) ||
                    wakingReceiverId !== null
                  }
                  onPress={() => {
                    if (!member) {
                      return;
                    }
                    if (member.is_me) {
                      onSelfVerify();
                      return;
                    }
                    setSelectedMember(member);
                  }}
                  style={[
                    styles.fullCapacityActionButton,
                    member &&
                    (member.is_me ? member.state !== 'AWAKE' : member.can_wake)
                      ? styles.backendWakeActionEnabled
                      : styles.backendWakeActionDisabled,
                    {
                      left: position.left * scale,
                      top: (position.top + 228) * scale,
                      width: 171 * scale,
                      height: 44 * scale,
                      borderRadius: 8 * scale,
                    },
                  ]}
                >
                  <Text style={styles.fullCapacityActionText}>
                    {member && wakingReceiverId === member.user_id
                      ? '요청 중...'
                      : member
                      ? actionText(member)
                      : '친구 초대하기'}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            <Modal
              animationType="fade"
              onRequestClose={() => setSelectedMember(null)}
              statusBarTranslucent
              transparent
              visible={selectedMember !== null}
            >
              <View style={styles.wakeConfirmOverlay}>
                <View
                  style={[
                    styles.wakeConfirmPanel,
                    {
                      width: 320 * scale,
                      height: 315 * scale,
                      borderRadius: 16 * scale,
                    },
                  ]}
                >
                  <Image
                    accessibilityLabel="주의"
                    resizeMode="contain"
                    source={require('../assets/images/wake-caution.png')}
                    style={[
                      styles.wakeConfirmIcon,
                      { width: 104 * scale, height: 104 * scale },
                    ]}
                  />
                  <Text style={styles.wakeConfirmTitle}>
                    {selectedMember?.nickname}님을 깨울까요?
                  </Text>
                  <Text style={styles.wakeConfirmDescription}>
                    깨우기 알림을 보낼게요
                  </Text>
                  <View style={styles.wakeConfirmActions}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="안 깨울래요"
                      activeOpacity={0.8}
                      disabled={wakingReceiverId !== null}
                      onPress={() => setSelectedMember(null)}
                      style={[
                        styles.wakeConfirmButton,
                        styles.wakeConfirmCancelButton,
                      ]}
                    >
                      <Text style={styles.wakeConfirmCancelText}>
                        안 깨울래요
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="깨울게요"
                      activeOpacity={0.8}
                      disabled={wakingReceiverId !== null}
                      onPress={() => confirmWake().catch(() => undefined)}
                      style={[
                        styles.wakeConfirmButton,
                        styles.wakeConfirmAcceptButton,
                      ]}
                    >
                      <Text style={styles.wakeConfirmAcceptText}>
                        {wakingReceiverId !== null ? '요청 중...' : '깨울게요'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
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
                  right: 28 * scale,
                  top: 52 * scale,
                  width: 250 * scale,
                  height: 105 * scale,
                  borderRadius: 30 * scale,
                },
              ]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false);
                  setRenameInput(detail?.name ?? fallbackName ?? '');
                  setRenameVisible(true);
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
                  setLeaveConfirmVisible(true);
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
            if (!renaming) {
              setRenameVisible(false);
            }
          }}
          statusBarTranslucent
          transparent
          visible={renameVisible}
        >
          <View style={styles.wakeConfirmOverlay}>
            <View
              style={[
                styles.renameGroupPanel,
                { width: 320 * scale, borderRadius: 16 * scale },
              ]}
            >
              <Text style={styles.renameGroupTitle}>방 이름 바꾸기</Text>
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
              <View style={styles.wakeConfirmActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  disabled={renaming}
                  onPress={() => setRenameVisible(false)}
                  style={[
                    styles.wakeConfirmButton,
                    styles.wakeConfirmCancelButton,
                  ]}
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
                  style={[
                    styles.wakeConfirmButton,
                    styles.wakeConfirmAcceptButton,
                  ]}
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
          scale={scale}
          submitting={leaving}
          visible={leaveConfirmVisible}
        />
      </View>
    </SafeAreaView>
  );
};

type LeaveGroupConfirmModalProps = {
  visible: boolean;
  scale: number;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
};

const CapacityFullModal = ({
  visible,
  scale,
  onClose,
}: Omit<LeaveGroupConfirmModalProps, 'onCancel' | 'onConfirm'> & {
  onClose: () => void;
}) => (
  <Modal
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
    transparent
    visible={visible}
  >
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="정원 가득 참 안내 닫기"
      onPress={onClose}
      style={styles.wakeConfirmOverlay}
    >
      <Pressable
        onPress={event => event.stopPropagation()}
        style={[
          styles.capacityFullPanel,
          {
            width: 320 * scale,
            height: 315 * scale,
            borderRadius: 16 * scale,
          },
        ]}
      >
        <Image
          accessibilityLabel="정원 가득 참 경고"
          resizeMode="contain"
          source={require('../assets/images/wake-caution.png')}
          style={{ width: 104 * scale, height: 104 * scale }}
        />
        <Text style={styles.capacityFullTitle}>정원이 가득 찼어요</Text>
        <Text style={styles.capacityFullDescription}>
          최대 8명까지 초대 가능해요
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="인원 확장하기"
          activeOpacity={0.8}
          onPress={onClose}
          style={[
            styles.capacityFullButton,
            {
              width: 245.75 * scale,
              height: 44 * scale,
              borderRadius: 8 * scale,
            },
          ]}
        >
          <Text style={styles.capacityFullButtonText}>인원 확장하기</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

const AiFriendConfirmModal = ({
  visible,
  scale,
  onCancel,
  onConfirm,
}: LeaveGroupConfirmModalProps) => (
  <Modal
    animationType="fade"
    onRequestClose={onCancel}
    statusBarTranslucent
    transparent
    visible={visible}
  >
    <View style={styles.wakeConfirmOverlay}>
      <View
        style={[
          styles.aiFriendConfirmPanel,
          {
            width: 320 * scale,
            height: 315 * scale,
            borderRadius: 16 * scale,
          },
        ]}
      >
        <Image
          accessibilityLabel="AI 친구 활성화 안내"
          resizeMode="contain"
          source={require('../assets/images/wake-caution.png')}
          style={{ width: 104 * scale, height: 104 * scale }}
        />
        <Text style={styles.leaveConfirmTitle}>AI 친구를 활성화할까요?</Text>
        <Text style={styles.aiFriendConfirmDescription}>
          남은 인원이 1명이에요
        </Text>
        <View style={styles.aiFriendConfirmActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="AI 친구 활성화하지 않기"
            activeOpacity={0.8}
            onPress={onCancel}
            style={[styles.leaveConfirmButton, styles.leaveConfirmCancelButton]}
          >
            <Text style={styles.leaveConfirmCancelText}>아니요</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="AI 친구 활성화"
            activeOpacity={0.8}
            onPress={onConfirm}
            style={[styles.leaveConfirmButton, styles.leaveConfirmAcceptButton]}
          >
            <Text style={styles.leaveConfirmAcceptText}>네</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const InviteFriendBanner = ({
  visible,
  scale,
}: {
  visible: boolean;
  scale: number;
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.inviteFriendBanner,
        {
          top: 59 * scale,
          width: 346 * scale,
          height: 58 * scale,
          borderRadius: 16 * scale,
        },
      ]}
    >
      <Text style={styles.inviteFriendBannerText}>친구를 초대해보세요</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: Colors.background,
  },
  headerIconButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  groupTitle: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textBlack,
    fontFamily: 'PretendardSemiBold',
    fontSize: 16,
    lineHeight: 19,
  },
  groupMemberCount: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  groupDetailState: {
    position: 'absolute',
    top: 145,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  groupDetailStateText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    lineHeight: 19,
  },
  backendWakeActionEnabled: {
    backgroundColor: '#FF4B4B',
  },
  backendWakeActionDisabled: {
    backgroundColor: '#202224',
  },
  inviteMemberCard: {
    position: 'absolute',
    overflow: 'hidden',
  },
  inviteSelfCard: {
    backgroundColor: Colors.gray,
  },
  inviteEmptyCard: {
    borderWidth: 1,
    borderColor: 'rgba(234, 234, 234, 0.9)',
    backgroundColor: Colors.background,
  },
  inviteMemberMeta: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 3,
  },
  inviteMetaText: {
    color: Colors.textGray,
    fontFamily: 'PretendardSemiBold',
    fontSize: 10,
    lineHeight: 12,
  },
  inviteMetaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.textGray,
  },
  inviteSleepDetails: {
    position: 'absolute',
    flexDirection: 'row',
    columnGap: 37,
  },
  inviteSleepValue: {
    color: Colors.textGray,
    fontFamily: 'PretendardBold',
    fontSize: 14,
    lineHeight: 17,
  },
  inviteSleepLabel: {
    marginTop: 1,
    color: Colors.textGray,
    fontFamily: 'PretendardSemiBold',
    fontSize: 10,
    lineHeight: 12,
  },
  inviteActionButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteActionButtonActive: {
    backgroundColor: '#202224',
  },
  wakeActionButton: {
    backgroundColor: '#FF4B4B',
  },
  wakeActionRequestedButton: {
    backgroundColor: Colors.gray,
  },
  wakeActionRequestedText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeConfirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  wakeConfirmPanel: {
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  wakeSuccessPanel: {
    alignItems: 'center',
    paddingTop: 27,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  wakeSuccessTitle: {
    marginTop: 15,
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
  },
  wakeSuccessDescription: {
    marginTop: 6,
    color: Colors.textGray,
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
  wakeSuccessLaterButton: {
    backgroundColor: Colors.gray,
  },
  wakeSuccessSendButton: {
    backgroundColor: '#FF4B4B',
  },
  wakeSuccessLaterText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeSuccessSendText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  leaveConfirmPanel: {
    alignItems: 'center',
    paddingTop: 46,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  leaveConfirmTitle: {
    marginTop: 15,
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
  },
  leaveConfirmActions: {
    position: 'absolute',
    right: 15,
    bottom: 42.5,
    left: 15,
    flexDirection: 'row',
    columnGap: 16,
  },
  leaveConfirmButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  leaveConfirmCancelButton: {
    backgroundColor: Colors.gray,
  },
  leaveConfirmAcceptButton: {
    backgroundColor: '#FF4B4B',
  },
  leaveConfirmCancelText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  leaveConfirmAcceptText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  aiFriendConfirmPanel: {
    alignItems: 'center',
    paddingTop: 26,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  aiFriendConfirmDescription: {
    marginTop: 6,
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
    textAlign: 'center',
  },
  aiFriendConfirmActions: {
    position: 'absolute',
    right: 15,
    bottom: 39,
    left: 15,
    flexDirection: 'row',
    columnGap: 16,
  },
  inviteFriendBanner: {
    position: 'absolute',
    zIndex: 20,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  inviteFriendBannerText: {
    color: Colors.textBlack,
    fontFamily: 'PretendardSemiBold',
    fontSize: 16,
    lineHeight: 19,
    textAlign: 'center',
  },
  wakeLockedPanel: {
    alignItems: 'center',
    paddingTop: 21,
    backgroundColor: Colors.background,
  },
  wakeLockedTitle: {
    marginTop: 15,
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
  },
  wakeLockedDescription: {
    marginTop: 6,
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
    textAlign: 'center',
  },
  wakeLockedConfirmButton: {
    position: 'absolute',
    bottom: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4B4B',
  },
  wakeLockedConfirmText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeConfirmIcon: {
    marginTop: 26,
  },
  wakeConfirmTitle: {
    marginTop: 15,
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
  },
  wakeConfirmDescription: {
    marginTop: 6,
    color: Colors.textGray,
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
  wakeConfirmCancelButton: {
    backgroundColor: Colors.gray,
  },
  wakeConfirmAcceptButton: {
    backgroundColor: '#FF4B4B',
  },
  wakeConfirmCancelText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    lineHeight: 17,
  },
  wakeConfirmAcceptText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    lineHeight: 17,
  },
  inviteActionButtonInactive: {
    borderWidth: 1,
    borderColor: Colors.gray,
    backgroundColor: Colors.background,
  },
  inviteActionTextActive: {
    color: '#F6F6F6',
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  inviteActionTextInactive: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  aiFriendCard: {
    position: 'absolute',
    backgroundColor: '#202224',
  },
  aiFriendButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202224',
  },
  aiFriendButtonFill: {
    backgroundColor: '#202224',
  },
  aiFriendButtonText: {
    color: '#F6F6F6',
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  waitingMemberCard: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: Colors.gray,
  },
  fullCapacityMemberCard: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(234, 234, 234, 0.9)',
    backgroundColor: '#C4C4C4',
  },
  fullCapacityDetailValue: {
    color: '#F6F6F6',
    fontFamily: 'PretendardBold',
    fontSize: 14,
    lineHeight: 17,
    textAlign: 'center',
  },
  fullCapacityDetailLabel: {
    color: '#F6F6F6',
    fontFamily: 'PretendardSemiBold',
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  fullCapacitySleepDetails: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 30,
  },
  fullCapacityFirstDetailColumn: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
  },
  fullCapacitySecondDetailColumn: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
  },
  fullCapacityActionButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullCapacityActionText: {
    color: '#F6F6F6',
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  fullCapacityPageControl: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
  },
  fullCapacityPageDot: {
    backgroundColor: '#B8B8B8',
  },
  fullCapacityPageDotActive: {
    backgroundColor: Colors.textBlack,
  },
  capacityFullPanel: {
    alignItems: 'center',
    paddingTop: 21,
    backgroundColor: Colors.background,
  },
  capacityFullTitle: {
    marginTop: 15,
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
  },
  capacityFullDescription: {
    marginTop: 6,
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
    textAlign: 'center',
  },
  capacityFullButton: {
    position: 'absolute',
    bottom: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4B4B',
  },
  capacityFullButtonText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  helpNeededCard: {
    backgroundColor: '#FF4B4B',
  },
  scheduleRestrictedCard: {
    backgroundColor: '#202224',
  },
  schedulePen: {
    position: 'absolute',
  },
  scheduleRestrictedText: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textWhite,
    fontFamily: 'PretendardBold',
    fontSize: 14,
    lineHeight: 17,
  },
  helpFire: {
    position: 'absolute',
  },
  helpNeededText: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textWhite,
    fontFamily: 'PretendardBold',
    fontSize: 14,
    lineHeight: 17,
  },
  memberPhoto: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  expandedPhotoCard: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: Colors.gray,
  },
  expandedMemberIdentity: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  expandedMemberMeta: {
    color: Colors.textWhite,
    fontFamily: 'PretendardSemiBold',
    fontSize: 16,
    lineHeight: 19,
  },
  expandedPhotoDetails: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  expandedPhotoValue: {
    color: Colors.textWhite,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
  },
  expandedPhotoLabel: {
    color: Colors.textWhite,
    fontFamily: 'PretendardSemiBold',
    fontSize: 16,
    lineHeight: 19,
  },
  wakeAlarm: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1,
  },
  memberIdentity: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    color: Colors.textBlack,
    fontFamily: 'PretendardSemiBold',
    fontSize: 8,
    lineHeight: 10,
  },
  memberNameOnPhoto: {
    color: Colors.textWhite,
  },
  memberMetaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.textGray,
  },
  memberMetaDotOnPhoto: {
    backgroundColor: Colors.textWhite,
  },
  sleepDetails: {
    position: 'absolute',
    flexDirection: 'row',
    columnGap: 22,
  },
  sleepDetailColumn: {
    alignItems: 'center',
  },
  sleepValue: {
    color: 'rgba(172, 172, 172, 0.85)',
    fontFamily: 'PretendardBold',
    fontSize: 14,
    lineHeight: 17,
  },
  sleepLabel: {
    marginTop: 1,
    color: 'rgba(172, 172, 172, 0.85)',
    fontFamily: 'PretendardSemiBold',
    fontSize: 10,
    lineHeight: 12,
  },
  awakeDetailText: {
    color: Colors.textWhite,
  },
  memberActionRow: {
    position: 'absolute',
    flexDirection: 'row',
  },
  memberActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfAwakeButton: {
    backgroundColor: Colors.secondary,
  },
  awakeSelfButton: {
    borderWidth: 1,
    borderColor: Colors.secondary,
    backgroundColor: Colors.background,
  },
  selfAwakeButtonText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  awakeSelfButtonText: {
    color: Colors.secondary,
  },
  photoLockedButton: {
    backgroundColor: '#FF4B4B',
  },
  photoLockedButtonText: {
    color: Colors.textWhite,
  },
  wakeCompletedButton: {
    backgroundColor: '#202224',
  },
  wakeCompletedButtonText: {
    color: Colors.textWhite,
  },
  waitingWakeButton: {
    backgroundColor: '#B8B8B8',
  },
  wakeRequestedButton: {
    borderWidth: 1,
    borderColor: Colors.secondary,
    backgroundColor: Colors.background,
  },
  waitingWakeButtonText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  wakeRequestedButtonText: {
    color: Colors.secondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  menuPanel: {
    position: 'absolute',
    overflow: 'hidden',
    paddingVertical: 7,
    backgroundColor: 'rgba(244, 244, 244, 0.88)',
    shadowColor: Colors.textBlack,
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
    color: Colors.textBlack,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 20,
  },
  renameGroupPanel: {
    padding: 24,
    backgroundColor: Colors.background,
  },
  renameGroupTitle: {
    marginBottom: 20,
    color: Colors.textBlack,
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
    borderColor: '#D9D9D9',
    borderRadius: 8,
    color: Colors.textBlack,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
  },
});
