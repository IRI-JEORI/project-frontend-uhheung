import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import SplashScreen from '../index';
import { ApiError, nunnunApi, tokenStorage } from '../../../api';
import { registerDeviceAfterLogin } from '../../../notifications/messaging';

const mockReplace = jest.fn();
const mockReset = jest.fn();
const mockSetAuthenticatedNavigationReady = jest.fn();
const mockClearPendingWakeRequestNavigation = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace, reset: mockReset }),
}));

jest.mock('../../../api', () => {
  class MockApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code = 'UNAUTHORIZED') {
      super(code);
      this.status = status;
      this.code = code;
    }
  }

  return {
    ApiError: MockApiError,
    tokenStorage: {
      getAccessToken: jest.fn(),
      getRefreshToken: jest.fn(),
      clear: jest.fn(),
    },
    nunnunApi: {
      auth: { reissue: jest.fn() },
      user: { getMe: jest.fn() },
      wake: { getPendingRequest: jest.fn() },
    },
  };
});

jest.mock('../../../notifications/messaging', () => ({
  registerDeviceAfterLogin: jest.fn(),
}));

jest.mock('../../../navigation/rootNavigation', () => ({
  clearPendingWakeRequestNavigation: () =>
    mockClearPendingWakeRequestNavigation(),
  createAuthenticatedNavigationState: (requestId?: number) => ({
    index: requestId === undefined ? 0 : 1,
    routes: requestId === undefined
      ? [{ name: 'Home' }]
      : [
          { name: 'Home' },
          { name: 'WakeNotification', params: { requestId } },
        ],
  }),
  setAuthenticatedNavigationReady: (ready: boolean) =>
    mockSetAuthenticatedNavigationReady(ready),
}));

jest.mock('../../../components/Logo', () => 'Logo');

const renderSplash = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<SplashScreen />);
  });
  return renderer;
};

describe('SplashScreen session restoration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
    jest.mocked(tokenStorage.getRefreshToken).mockResolvedValue('refresh-token');
    jest.mocked(tokenStorage.clear).mockResolvedValue([undefined, undefined]);
    jest.mocked(nunnunApi.user.getMe).mockResolvedValue({} as never);
    jest.mocked(nunnunApi.auth.reissue).mockResolvedValue({} as never);
    jest.mocked(nunnunApi.wake.getPendingRequest).mockResolvedValue(null);
    jest.mocked(registerDeviceAfterLogin).mockResolvedValue(undefined);
  });

  it('restores a persisted session without showing Login', async () => {
    const renderer = await renderSplash();

    expect(nunnunApi.user.getMe).toHaveBeenCalledTimes(1);
    expect(registerDeviceAfterLogin).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
    expect(mockSetAuthenticatedNavigationReady).toHaveBeenLastCalledWith(true);
    expect(mockReplace).not.toHaveBeenCalledWith('Login');
    await act(async () => renderer.unmount());
  });

  it('reissues when only a refresh token remains', async () => {
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue(null);
    const renderer = await renderSplash();

    expect(nunnunApi.auth.reissue).toHaveBeenCalledWith('refresh-token');
    expect(nunnunApi.user.getMe).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('restores a still-valid access token even when no refresh token remains', async () => {
    jest.mocked(tokenStorage.getRefreshToken).mockResolvedValue(null);
    const renderer = await renderSplash();

    expect(nunnunApi.auth.reissue).not.toHaveBeenCalled();
    expect(nunnunApi.user.getMe).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('opens Login and discards queued navigation when no session exists', async () => {
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue(null);
    jest.mocked(tokenStorage.getRefreshToken).mockResolvedValue(null);
    const renderer = await renderSplash();

    expect(mockClearPendingWakeRequestNavigation).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('Login');
    expect(nunnunApi.user.getMe).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('reissues a rejected access token and opens the pending request', async () => {
    jest
      .mocked(nunnunApi.user.getMe)
      .mockRejectedValueOnce(new ApiError(401))
      .mockResolvedValueOnce({} as never);
    jest.mocked(nunnunApi.wake.getPendingRequest).mockResolvedValue({ id: 42 } as never);
    const renderer = await renderSplash();

    expect(nunnunApi.auth.reissue).toHaveBeenCalledWith('refresh-token');
    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'WakeNotification', params: { requestId: 42 } },
      ],
    });
    await act(async () => renderer.unmount());
  });

  it('clears an invalid persisted session and opens Login', async () => {
    jest.mocked(nunnunApi.user.getMe).mockRejectedValue(new ApiError(401));
    jest.mocked(nunnunApi.auth.reissue).mockRejectedValue(new ApiError(401));
    const renderer = await renderSplash();

    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('Login');
    expect(mockReset).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('keeps a stored access-token session on a transient API failure', async () => {
    jest.mocked(nunnunApi.user.getMe).mockRejectedValue(new ApiError(0));
    const renderer = await renderSplash();

    expect(tokenStorage.clear).not.toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
    expect(mockReplace).not.toHaveBeenCalledWith('Login');
    await act(async () => renderer.unmount());
  });
});
