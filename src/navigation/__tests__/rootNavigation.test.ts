import {
  clearPendingWakeRequestNavigation,
  createAuthenticatedNavigationState,
  isSameWakeNotificationRoute,
  navigationRef,
  openWakeNotification,
  setAuthenticatedNavigationReady,
} from '../rootNavigation';

describe('authenticated navigation state', () => {
  it('removes Login and leaves Home as the only route without a pending request', () => {
    expect(createAuthenticatedNavigationState()).toEqual({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  });

  it('removes Login and places a pending WakeNotification above Home', () => {
    expect(createAuthenticatedNavigationState(42)).toEqual({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'WakeNotification', params: { requestId: 42 } },
      ],
    });
  });
});

describe('wake notification root navigation', () => {
  beforeEach(() => {
    clearPendingWakeRequestNavigation();
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    jest.spyOn(navigationRef, 'navigate').mockImplementation(jest.fn());
    jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recognizes when the same request is already open', () => {
    expect(
      isSameWakeNotificationRoute(
        { name: 'WakeNotification', params: { requestId: 42 } },
        42,
      ),
    ).toBe(true);
  });

  it('does not suppress a different pending request', () => {
    expect(
      isSameWakeNotificationRoute(
        { name: 'WakeNotification', params: { requestId: 41 } },
        42,
      ),
    ).toBe(false);
  });

  it('queues cold-start navigation until session restoration completes', () => {
    openWakeNotification(42);
    expect(navigationRef.navigate).not.toHaveBeenCalled();

    setAuthenticatedNavigationReady(true);

    expect(navigationRef.navigate).toHaveBeenCalledWith('WakeNotification', {
      requestId: 42,
    });
  });

  it('does not duplicate the request restored directly into navigation state', () => {
    openWakeNotification(42);
    jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue({
      key: 'wake-42',
      name: 'WakeNotification',
      params: { requestId: 42 },
    });

    setAuthenticatedNavigationReady(true);

    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });
});
