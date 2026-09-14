import {
  Alert,
  PermissionsAndroid,
  Platform,
  type PermissionStatus,
} from 'react-native';
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { nunnunApi } from '../api/nunnunApi';
import { tokenStorage } from '../api/tokenStorage';
import { openWakeNotification } from '../navigation/rootNavigation';
import { parseWakeRequestPayload } from './wakeRequestPayload';
import { WakeAlarm } from '../wakeAlarm/WakeAlarm';

const notificationPermissionGranted = async () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (Platform.Version < 33) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) {
    return true;
  }

  const status: PermissionStatus = await PermissionsAndroid.request(permission);
  return status === PermissionsAndroid.RESULTS.GRANTED;
};

const registerToken = async (token: string) => {
  if (!(await tokenStorage.getAccessToken())) {
    return;
  }

  await nunnunApi.device.register(token);
};

const hasStoredSession = async () =>
  Boolean(
    (await tokenStorage.getAccessToken()) ??
      (await tokenStorage.getRefreshToken()),
  );

export const registerDeviceAfterLogin = async () => {
  try {
    if (!(await notificationPermissionGranted())) {
      return;
    }

    const messaging = getMessaging();
    await registerDeviceForRemoteMessages(messaging);
    await registerToken(await getToken(messaging));
  } catch {
    // Push registration must not turn a successful login into a login failure.
  }
};

export const openWakeRequest = async (requestId: number) => {
  if (!(await hasStoredSession())) {
    return;
  }
  await WakeAlarm.start(requestId);
  openWakeNotification(requestId);
};

const openWakeRequestFromMessage = async (message: RemoteMessage | null) => {
  const params = parseWakeRequestPayload(message?.data);
  if (params) {
    await openWakeRequest(params.requestId);
  }
};

export const registerBackgroundMessageHandler = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async message => {
    const params = parseWakeRequestPayload(message.data);
    if (!params || !(await hasStoredSession())) {
      return;
    }
    await WakeAlarm.start(params.requestId);
  });
};

export const startForegroundMessaging = () => {
  if (Platform.OS !== 'android') {
    return () => undefined;
  }

  const messaging = getMessaging();
  const unsubscribeTokenRefresh = onTokenRefresh(messaging, token => {
    registerToken(token).catch(() => undefined);
  });

  const unsubscribeForeground = onMessage(messaging, async message => {
    const params = parseWakeRequestPayload(message.data);
    if (!params) {
      return;
    }
    if (!(await hasStoredSession())) {
      return;
    }
    await WakeAlarm.start(params.requestId);

    Alert.alert(
      message.notification?.title ??
        (typeof message.data?.title === 'string'
          ? message.data.title
          : '깨우기 요청이 왔어요'),
      message.notification?.body ??
        (typeof message.data?.body === 'string'
          ? message.data.body
          : '깨우기 요청을 확인해주세요.'),
      [
        { text: '나중에', style: 'cancel' },
        {
          text: '확인',
          onPress: () => {
            openWakeRequest(params.requestId).catch(() => undefined);
          },
        },
      ],
    );
  });

  const unsubscribeOpened = onNotificationOpenedApp(
    messaging,
    openWakeRequestFromMessage,
  );

  getInitialNotification(messaging)
    .then(openWakeRequestFromMessage)
    .catch(() => undefined);

  return () => {
    unsubscribeTokenRefresh();
    unsubscribeForeground();
    unsubscribeOpened();
  };
};
