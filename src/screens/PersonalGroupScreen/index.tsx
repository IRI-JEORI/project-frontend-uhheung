import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { ApiError, nunnunApi } from '../../api';
import type { CreateFixedScheduleRequest, CurrentUser, DndWindow, FixedSchedule, MyStatsResponse } from '../../api/types';
import ProfileHeader from './components/ProfileHeader';
import AccordionSection from './components/AccordionSection';
import ScheduleRow from './components/ScheduleRow';
import AddRowButton from './components/AddRowButton';
import SettingsRow from './components/SettingsRow';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import AddScheduleMethodModal from './components/AddScheduleMethodModal';
import ManualScheduleSheet from './components/ManualScheduleSheet';
import DndWindowSheet from './components/DndWindowSheet';
import { formatDayOfWeek } from '../../utils/dayOfWeek';
import { formatTime } from '../../utils/time';
import { clearPendingWakeRequestNavigation } from '../../navigation/rootNavigation';

type SectionKey = 'FIXED' | 'DND' | 'SETTINGS' | 'REWARD';
type ScheduleModal = 'METHOD' | 'MANUAL' | null;

const PersonalGroupScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'PersonalGroup'>>();
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set());
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<MyStatsResponse | null>(null);
  const [fixedSchedules, setFixedSchedules] = useState<FixedSchedule[]>([]);
  const [dndWindows, setDndWindows] = useState<DndWindow[]>([]);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<ScheduleModal>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [dndSheetVisible, setDndSheetVisible] = useState(false);
  const [dndSaving, setDndSaving] = useState(false);
  const dndSavingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        nunnunApi.user.getMe(),
        nunnunApi.me.getStats(),
        nunnunApi.schedule.list(),
        nunnunApi.dnd.list(),
      ])
        .then(([user, statsData, schedules, dnd]) => {
          if (!active) return;
          setProfile(user);
          setStats(statsData);
          setFixedSchedules(schedules);
          setDndWindows(dnd.windows);
        })
        .catch(() => {
          if (active) Alert.alert('조회 실패', '내 정보를 불러오지 못했어요.');
        });
      return () => { active = false; };
    }, []),
  );

  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await nunnunApi.auth.logout();
      clearPendingWakeRequestNavigation();
      setLogoutModalVisible(false);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
    } catch (error) {
      Alert.alert('로그아웃 실패', error instanceof ApiError ? error.message : '로그아웃하지 못했어요.');
    }
  };

  const createFixedSchedule = async (input: CreateFixedScheduleRequest) => {
    if (scheduleSaving) return false;
    setScheduleSaving(true);
    try {
      await nunnunApi.schedule.create(input);
      setScheduleModal(null);
      setFixedSchedules(await nunnunApi.schedule.list());
      return true;
    } catch (error) {
      Alert.alert(
        '저장 실패',
        error instanceof ApiError ? error.message : '고정 일정을 저장하지 못했어요.',
      );
      return false;
    } finally {
      setScheduleSaving(false);
    }
  };

  const createDndWindow = async (displayText: string) => {
    if (dndSavingRef.current) return false;
    dndSavingRef.current = true;
    setDndSaving(true);
    try {
      await nunnunApi.dnd.create(displayText);
      const dnd = await nunnunApi.dnd.list();
      setDndWindows(dnd.windows);
      setDndSheetVisible(false);
      return true;
    } catch (error) {
      Alert.alert(
        '저장 실패',
        error instanceof ApiError ? error.message : '방해금지 시간을 저장하지 못했어요.',
      );
      return false;
    } finally {
      dndSavingRef.current = false;
      setDndSaving(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ProfileHeader
          nickname={profile?.nickname ?? '사용자'}
          streakText={stats ? `${stats.streak_days}일 연속 기상 성공 · 성공률 ${stats.success_rate}%` : '기상 통계를 불러오는 중이에요'}
          onPressBack={() => navigation.goBack()}
        />
        <View style={styles.sections}>
          <AccordionSection title="내 고정 시간표" expanded={expandedSections.has('FIXED')} onToggle={() => toggleSection('FIXED')}>
            {fixedSchedules.map(item => <ScheduleRow key={item.id} label={`${formatDayOfWeek(item.dayOfWeek)} ${formatTime(item.startTime)}~${formatTime(item.endTime)} ${item.title}`} />)}
            <AddRowButton label="시간표 추가하기" onPress={() => setScheduleModal('METHOD')} />
          </AccordionSection>
          <AccordionSection title="방해금지 시간대" rightLabel={`${dndWindows.length}개 적용 중이에요`} expanded={expandedSections.has('DND')} onToggle={() => toggleSection('DND')}>
            {dndWindows.map(item => <ScheduleRow key={item.id} label={`${formatDayOfWeek(item.day_of_week)} ${formatTime(item.start_time)}~${formatTime(item.end_time)}`} />)}
            <AddRowButton label="방해금지 시간대 추가하기" onPress={() => setDndSheetVisible(true)} />
          </AccordionSection>
          <AccordionSection title="설정" expanded={expandedSections.has('SETTINGS')} onToggle={() => toggleSection('SETTINGS')}>
            <SettingsRow label="로그아웃" onPress={() => setLogoutModalVisible(true)} />
            <SettingsRow label="기상 통계" onPress={() => navigation.navigate('Stats')} />
          </AccordionSection>
          <AccordionSection title="내 리워드" expanded={expandedSections.has('REWARD')} onToggle={() => toggleSection('REWARD')}>
            <ScheduleRow label="리워드는 현재 Demo 기능이에요" />
          </AccordionSection>
        </View>
        <AddRowButton label="목표 기상 시간 설정하기" onPress={() => navigation.navigate('WakeTargets')} />
      </ScrollView>
      <LogoutConfirmModal visible={logoutModalVisible} onCancel={() => setLogoutModalVisible(false)} onConfirm={() => handleLogout().catch(() => undefined)} />
      <AddScheduleMethodModal
        visible={scheduleModal === 'METHOD'}
        onClose={() => setScheduleModal(null)}
        onConfirmManual={() => setScheduleModal('MANUAL')}
      />
      <ManualScheduleSheet
        visible={scheduleModal === 'MANUAL'}
        submitting={scheduleSaving}
        onClose={() => setScheduleModal(null)}
        onConfirm={createFixedSchedule}
      />
      <DndWindowSheet
        visible={dndSheetVisible}
        submitting={dndSaving}
        onClose={() => setDndSheetVisible(false)}
        onConfirm={createDndWindow}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flexGrow: 1, paddingBottom: 40 },
  sections: { marginTop: 24 },
});

export default PersonalGroupScreen;
