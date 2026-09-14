import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/tokens';
import Logo from '../../components/Logo';
import { ApiError, nunnunApi, tokenStorage } from '../../api';
import { registerDeviceAfterLogin } from '../../notifications/messaging';
import {
  clearPendingWakeRequestNavigation,
  createAuthenticatedNavigationState,
  setAuthenticatedNavigationReady,
} from '../../navigation/rootNavigation';

const LOGO_COLOR = colors.bannerBg;
import { RootStackParamList } from '../../navigation/types';

const shouldClearStoredSession = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 401 ||
    error.code === 'INVALID_REFRESH_TOKEN' ||
    error.code === 'EXPIRED_REFRESH_TOKEN');

const SplashScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Splash'>>();

  useEffect(() => {
    let active = true;
    setAuthenticatedNavigationReady(false);

    const restoreSession = async () => {
      const [accessToken, refreshToken] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ]);

      if (!accessToken && !refreshToken) {
        clearPendingWakeRequestNavigation();
        if (active) {
          navigation.replace('Login');
        }
        return;
      }

      try {
        if (!accessToken && refreshToken) {
          await nunnunApi.auth.reissue(refreshToken);
        }

        try {
          await nunnunApi.user.getMe();
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            throw error;
          }
          const currentRefreshToken =
            refreshToken ?? (await tokenStorage.getRefreshToken());
          if (!currentRefreshToken) {
            throw error;
          }
          await nunnunApi.auth.reissue(currentRefreshToken);
          await nunnunApi.user.getMe();
        }

        await registerDeviceAfterLogin();
        const pendingRequest = await nunnunApi.wake
          .getPendingRequest()
          .catch(() => null);

        if (!active) {
          return;
        }
        navigation.reset(
          createAuthenticatedNavigationState(pendingRequest?.id),
        );
        setAuthenticatedNavigationReady(true);
      } catch (error) {
        if (shouldClearStoredSession(error)) {
          await tokenStorage.clear();
          clearPendingWakeRequestNavigation();
          if (active) {
            navigation.replace('Login');
          }
          return;
        }

        if (active) {
          if (accessToken) {
            navigation.reset(createAuthenticatedNavigationState());
            setAuthenticatedNavigationReady(true);
          } else {
            navigation.replace('Login');
          }
        }
      }
    };

    restoreSession().catch(() => {
      if (active) {
        navigation.replace('Login');
      }
    });

    return () => {
      active = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Logo color={LOGO_COLOR} />
      <ActivityIndicator color={LOGO_COLOR} style={styles.indicator} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.charcoal,
  },
  indicator: {
    marginTop: 28,
  },
});

export default SplashScreen;
