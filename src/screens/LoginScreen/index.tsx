import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Logo from '../../components/Logo';
import { colors } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { ApiError, nunnunApi } from '../../api';
import BottomLinks from './components/BottomLinks';
import LoginForm from './components/LoginForm';
import { registerDeviceAfterLogin } from '../../notifications/messaging';
import type { User } from '../../api/types';
import {
  createAuthenticatedNavigationState,
  setAuthenticatedNavigationReady,
} from '../../navigation/rootNavigation';
import { WakeAlarm } from '../../wakeAlarm/WakeAlarm';

const LOGO_TOP_SPACING = 198;
const FORM_TOP_SPACING = 60;
const FORM_WIDTH = 320;
const BOTTOM_SPACING = 87;
const HORIZONTAL_PADDING = 20;
const MIN_LOGO_TOP_SPACING = 80;
const MIN_BOTTOM_SPACING = 24;

const LoginScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const formWidth = Math.min(
    FORM_WIDTH,
    Math.max(0, viewportWidth - HORIZONTAL_PADDING * 2),
  );
  const logoTopSpacing = Math.min(
    LOGO_TOP_SPACING,
    Math.max(MIN_LOGO_TOP_SPACING, viewportHeight * 0.24),
  );
  const bottomSpacing = Math.min(
    BOTTOM_SPACING,
    Math.max(MIN_BOTTOM_SPACING, viewportHeight * 0.1),
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setAccountError(null);
    setSelectedAccountId(null);
    try {
      const response = await nunnunApi.auth.getDemoAccounts();
      setAccounts(response.accounts);
      if (response.accounts.length === 0) {
        setAccountError('사용 가능한 데모 계정이 없어요.');
      }
    } catch {
      setAccounts([]);
      setAccountError('데모 계정을 불러오지 못했어요.');
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts().catch(() => undefined);
  }, [loadAccounts]);

  const handleLoginPress = async () => {
    if (isLoggingIn) {
      return;
    }
    if (selectedAccountId === null) {
      Alert.alert('로그인 안내', '로그인할 데모 계정을 선택해주세요.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await nunnunApi.auth.demoLogin(selectedAccountId);
      await registerDeviceAfterLogin();
      try {
        const pendingRequest = await nunnunApi.wake.getPendingRequest();
        if (pendingRequest) {
          await WakeAlarm.start(pendingRequest.id);
          navigation.reset(
            createAuthenticatedNavigationState(pendingRequest.id),
          );
          setAuthenticatedNavigationReady(true);
          return;
        }
      } catch {
        // Pending recovery must not turn a successful login into a login failure.
      }
      navigation.reset(createAuthenticatedNavigationState());
      setAuthenticatedNavigationReady(true);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : '서버에 연결할 수 없어요. 백엔드 서버가 켜져 있는지 확인해주세요.';
      Alert.alert('로그인 실패', message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: logoTopSpacing },
      ]}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <Logo color={colors.brownDarkest} />
      <View style={[styles.form, { width: formWidth }]}>
        <LoginForm
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          isLoadingAccounts={isLoadingAccounts}
          accountError={accountError}
          isLoggingIn={isLoggingIn}
          onSelectAccount={setSelectedAccountId}
          onRetryAccounts={() => loadAccounts().catch(() => undefined)}
          onLoginPress={handleLoginPress}
        />
      </View>
      <View style={styles.spacer} />
      <View style={{ marginBottom: bottomSpacing }}>
        <BottomLinks onRegisterPress={() => navigation.navigate('Register')} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  form: {
    marginTop: FORM_TOP_SPACING,
  },
  spacer: {
    flex: 1,
  },
});

export default LoginScreen;
