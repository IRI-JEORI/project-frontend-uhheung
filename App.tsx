import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PermissionScreen from './src/screens/PermissionScreen';
import PersonalGroupScreen from './src/screens/PersonalGroupScreen';
import { HomeScreen as MainHomeScreen } from './src/screens/HomeScreen';
import { AddGroupNameScreen } from './src/screens/AddGroupNameScreen';
import { AddGroupInviteScreen } from './src/screens/AddGroupInviteScreen';
import { WaitingForMembersScreen } from './src/screens/WaitingForMembersScreen';
import type { GroupType } from './src/types/group';
import type { WakeProofResult } from './src/api';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { InviteCodeScreen as MainInviteCodeScreen } from './src/screens/InviteCodeScreen';
import { CameraCaptureScreen as MainCameraCaptureScreen } from './src/screens/CameraCaptureScreen';
import { PhotoReviewScreen as MainPhotoReviewScreen } from './src/screens/PhotoReviewScreen.tsx';
import { WakeNotificationScreen } from './src/screens/WakeNotificationScreen';
import { PhotoAnalysisScreen } from './src/screens/PhotoAnalysisScreen';
import { PhotoAnalysisSuccessScreen } from './src/screens/PhotoAnalysisSuccessScreen';
import { PhotoAnalysisFailureScreen } from './src/screens/PhotoAnalysisFailureScreen';
import { RewardListScreen } from './src/screens/RewardListScreen';
import { SelfWakeVerificationScreen } from './src/screens/SelfWakeVerificationScreen';
import WakeGroupScreen from './src/screens/WakeGroupScreen';
import WakeAlarmScreen from './src/screens/WakeAlarmScreen';
import { WakeTargetScreen } from './src/screens/WakeTargetScreen';
import { DndWindowScreen } from './src/screens/DndWindowScreen';
import { FixedScheduleScreen } from './src/screens/FixedScheduleScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import {
  flushPendingWakeRequestNavigation,
  navigationRef,
} from './src/navigation/rootNavigation';
import {
  openWakeRequest,
  startForegroundMessaging,
} from './src/notifications/messaging';
import { listenForWakeAlarmNavigation } from './src/wakeAlarm/WakeAlarm';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Permission: undefined;
  PersonalGroup: undefined;
  Home: undefined;
  Settings: undefined;
  WakeTargets: undefined;
  DndWindows: undefined;
  FixedSchedules: undefined;
  Stats: undefined;
  InviteCode: undefined;
  CameraCapture: {
    memberName?: string;
    recipientName?: string;
    photographer?: 'jiwoo' | 'minju';
    onComplete?: (photoUri: string) => void;
    attempt?: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
  };
  PhotoReview: {
    photoPath: string;
    photoUri: string;
    memberName: string;
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    onComplete?: (photoUri: string) => void;
    attempt?: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
  };
  WakeNotification: { requestId: number } | undefined;
  PhotoAnalysis: {
    photoPath: string;
    photoUri?: string;
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    attempt?: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
  };
  PhotoAnalysisSuccess: {
    photoPath: string;
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    attempt?: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
    proofResult?: WakeProofResult;
  };
  PhotoAnalysisFailure: {
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    attempt: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
    proofResult?: WakeProofResult;
  };
  RewardList: undefined;
  SelfWakeVerification: {
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    groupId?: number;
    groupName?: string;
  };
  AddGroupName: { groupType: GroupType } | undefined;
  AddGroupInvite:
    | { groupType: GroupType; groupName: string; groupId?: number; inviteCode?: string }
    | undefined;
  WaitingForMembers:
    | {
        groupId?: number;
        groupType: GroupType;
        groupName?: string;
        viewer?: 'jiwoo' | 'minju';
      }
    | undefined;
  WakeGroupDetail: { groupId: number };
  WakeAlarm: { requestId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    const stopMessaging = startForegroundMessaging();
    const stopAlarmNavigation = listenForWakeAlarmNavigation(requestId => {
      openWakeRequest(requestId).catch(() => undefined);
    });
    return () => {
      stopMessaging();
      stopAlarmNavigation();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={flushPendingWakeRequestNavigation}
        onStateChange={flushPendingWakeRequestNavigation}
      >
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Permission" component={PermissionScreen} />
          <Stack.Screen name="PersonalGroup" component={PersonalGroupScreen} />
          <Stack.Screen name="Home" component={MainHomeScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="WakeTargets" component={WakeTargetScreen} />
          <Stack.Screen name="DndWindows" component={DndWindowScreen} />
          <Stack.Screen name="FixedSchedules" component={FixedScheduleScreen} />
          <Stack.Screen name="Stats" component={StatsScreen} />
          <Stack.Screen name="InviteCode" component={MainInviteCodeScreen} />
          <Stack.Screen name="CameraCapture" component={MainCameraCaptureScreen} />
          <Stack.Screen name="PhotoReview" component={MainPhotoReviewScreen} />
          <Stack.Screen
            name="WakeNotification"
            component={WakeNotificationScreen}
          />
          <Stack.Screen name="PhotoAnalysis" component={PhotoAnalysisScreen} />
          <Stack.Screen
            name="PhotoAnalysisSuccess"
            component={PhotoAnalysisSuccessScreen}
          />
          <Stack.Screen
            name="PhotoAnalysisFailure"
            component={PhotoAnalysisFailureScreen}
          />
          <Stack.Screen name="RewardList" component={RewardListScreen} />
          <Stack.Screen
            name="SelfWakeVerification"
            component={SelfWakeVerificationScreen}
          />
          <Stack.Screen name="AddGroupName" component={AddGroupNameScreen} />
          <Stack.Screen
            name="AddGroupInvite"
            component={AddGroupInviteScreen}
          />
          <Stack.Screen
            name="WaitingForMembers"
            component={WaitingForMembersScreen}
          />
          <Stack.Screen name="WakeGroupDetail" component={WakeGroupScreen} />
          <Stack.Screen name="WakeAlarm" component={WakeAlarmScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
