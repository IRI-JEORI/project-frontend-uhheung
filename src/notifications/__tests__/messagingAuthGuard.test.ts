import { Alert, Platform } from 'react-native';
import { tokenStorage } from '../../api/tokenStorage';
import { openWakeNotification } from '../../navigation/rootNavigation';
import {
  registerBackgroundMessageHandler,
  startForegroundMessaging,
} from '../messaging';
import { WakeAlarm } from '../../wakeAlarm/WakeAlarm';

let mockForegroundHandler: ((message: unknown) => Promise<void>) | undefined;
let mockOpenedHandler: ((message: unknown) => Promise<void>) | undefined;
let mockInitialMessage: unknown = null;
let mockBackgroundHandler: ((message: unknown) => Promise<void>) | undefined;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getInitialNotification: jest.fn(() => Promise.resolve(mockInitialMessage)),
  onMessage: jest.fn((_messaging, handler) => {
    mockForegroundHandler = handler;
    return jest.fn();
  }),
  onNotificationOpenedApp: jest.fn((_messaging, handler) => {
    mockOpenedHandler = handler;
    return jest.fn();
  }),
  onTokenRefresh: jest.fn(() => jest.fn()),
  getToken: jest.fn(),
  registerDeviceForRemoteMessages: jest.fn(),
  setBackgroundMessageHandler: jest.fn((_messaging, handler) => {
    mockBackgroundHandler = handler;
  }),
}));

jest.mock('../../wakeAlarm/WakeAlarm', () => ({
  WakeAlarm: { start: jest.fn(), stop: jest.fn() },
}));

jest.mock('../../navigation/rootNavigation', () => ({
  openWakeNotification: jest.fn(),
}));

const wakeMessage = {
  data: { type: 'WAKE_REQUEST', referenceId: '42' },
  notification: { title: '깨우기', body: '일어나세요' },
};

describe('FCM authenticated navigation guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockForegroundHandler = undefined;
    mockOpenedHandler = undefined;
    mockInitialMessage = null;
    mockBackgroundHandler = undefined;
    jest.mocked(WakeAlarm.start).mockResolvedValue(undefined);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
  });

  it('ignores foreground and opened notifications after logout', async () => {
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue(null);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    startForegroundMessaging();

    await mockForegroundHandler?.(wakeMessage);
    await mockOpenedHandler?.(wakeMessage);

    expect(alert).not.toHaveBeenCalled();
    expect(openWakeNotification).not.toHaveBeenCalled();
  });

  it('drops a cold-start wake payload without an authenticated session', async () => {
    mockInitialMessage = wakeMessage;
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue(null);
    jest.spyOn(tokenStorage, 'getRefreshToken').mockResolvedValue(null);

    startForegroundMessaging();
    await Promise.resolve();
    await Promise.resolve();

    expect(openWakeNotification).not.toHaveBeenCalled();
  });

  it('queues a cold-start wake payload while a refresh-token session restores', async () => {
    mockInitialMessage = wakeMessage;
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue(null);
    jest
      .spyOn(tokenStorage, 'getRefreshToken')
      .mockResolvedValue('refresh-token');

    startForegroundMessaging();
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(WakeAlarm.start).toHaveBeenCalledWith(42);
    expect(openWakeNotification).toHaveBeenCalledWith(42);
  });

  it('keeps opened-notification navigation while logged in', async () => {
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue('access-token');
    startForegroundMessaging();

    await mockOpenedHandler?.(wakeMessage);

    expect(WakeAlarm.start).toHaveBeenCalledWith(42);
    expect(openWakeNotification).toHaveBeenCalledWith(42);
  });

  it('starts the alarm immediately for foreground and background wake requests', async () => {
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue('access-token');
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    registerBackgroundMessageHandler();
    startForegroundMessaging();

    await mockForegroundHandler?.(wakeMessage);
    await mockBackgroundHandler?.(wakeMessage);

    expect(WakeAlarm.start).toHaveBeenNthCalledWith(1, 42);
    expect(WakeAlarm.start).toHaveBeenNthCalledWith(2, 42);
  });

  it('displays the data-only Android wake message sent by backend main', async () => {
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue('access-token');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    startForegroundMessaging();

    await mockForegroundHandler?.({
      data: {
        type: 'WAKE_REQUEST', referenceId: '42',
        title: 'Wake request', body: 'Your friend is waking you up.',
      },
    });

    expect(WakeAlarm.start).toHaveBeenCalledWith(42);
    expect(alert).toHaveBeenCalledWith(
      'Wake request', 'Your friend is waking you up.', expect.any(Array),
    );
  });

  it('does not start an alarm for bedtime or invalid payloads', async () => {
    jest.spyOn(tokenStorage, 'getAccessToken').mockResolvedValue('access-token');
    registerBackgroundMessageHandler();
    startForegroundMessaging();

    await mockForegroundHandler?.({
      data: { type: 'BEDTIME_REMINDER', referenceId: '42' },
    });
    await mockBackgroundHandler?.({
      data: { type: 'WAKE_REQUEST', referenceId: 'invalid' },
    });

    expect(WakeAlarm.start).not.toHaveBeenCalled();
  });
});
