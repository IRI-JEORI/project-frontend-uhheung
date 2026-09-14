import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Button from '../../../components/Button';
import LoginScreen from '../index';
import { nunnunApi } from '../../../api';
import { registerDeviceAfterLogin } from '../../../notifications/messaging';
import { WakeAlarm } from '../../../wakeAlarm/WakeAlarm';

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockSetAuthenticatedNavigationReady = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));

jest.mock('../../../api', () => ({
  ApiError: class ApiError extends Error {},
  nunnunApi: {
    auth: {
      getDemoAccounts: jest.fn(),
      demoLogin: jest.fn(),
    },
    wake: {
      getPendingRequest: jest.fn(),
    },
  },
}));

jest.mock('../../../notifications/messaging', () => ({
  registerDeviceAfterLogin: jest.fn(),
}));

jest.mock('../../../wakeAlarm/WakeAlarm', () => ({
  WakeAlarm: { start: jest.fn(), stop: jest.fn() },
}));

jest.mock('../../../navigation/rootNavigation', () => ({
  setAuthenticatedNavigationReady: (ready: boolean) =>
    mockSetAuthenticatedNavigationReady(ready),
  createAuthenticatedNavigationState: (requestId?: number) => ({
    index: requestId === undefined ? 0 : 1,
    routes: requestId === undefined
      ? [{ name: 'Home' }]
      : [
          { name: 'Home' },
          { name: 'WakeNotification', params: { requestId } },
        ],
  }),
}));

jest.mock('../../../components/Logo', () => 'Logo');
jest.mock('../../../components/TextField', () => 'TextField');

const accounts = [
  { id: 7, nickname: '눈눈', avatar_url: null },
  { id: 8, nickname: '지우', avatar_url: null },
  { id: 9, nickname: '민수', avatar_url: null },
];

describe('LoginScreen demo account selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(nunnunApi.auth.getDemoAccounts).mockResolvedValue({ accounts });
    jest.mocked(nunnunApi.auth.demoLogin).mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: accounts[0],
    });
    jest.mocked(registerDeviceAfterLogin).mockResolvedValue(undefined);
    jest.mocked(WakeAlarm.start).mockResolvedValue(undefined);
    jest.mocked(nunnunApi.wake.getPendingRequest).mockResolvedValue(null);
  });

  it.each([
    ['first', 7],
    ['second', 8],
    ['third', 9],
  ])('logs in with the %s selected backend account id', async (_, accountId) => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    await ReactTestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: `demo-account-${accountId}` })
        .props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      await renderer.root.findByType(Button).props.onPress();
    });

    expect(nunnunApi.auth.demoLogin).toHaveBeenCalledTimes(1);
    expect(nunnunApi.auth.demoLogin).toHaveBeenCalledWith(accountId);
    expect(registerDeviceAfterLogin).toHaveBeenCalledTimes(1);
    expect(nunnunApi.wake.getPendingRequest).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
    expect(mockSetAuthenticatedNavigationReady).toHaveBeenCalledWith(true);
  });

  it('opens the newest pending wake request after login', async () => {
    jest.mocked(nunnunApi.wake.getPendingRequest).mockResolvedValue({
      id: 42,
      group_id: 7,
      status: 'SENT',
      sender: { id: 8, nickname: '지우' },
      receiver: { id: 7, nickname: '눈눈' },
      requested_at: '2026-08-20T19:00:00+09:00',
      pose: {
        date: '2026-08-20',
        code: 'LOW_CROUCH',
        description: '몸을 낮게 웅크려 앉아주세요.',
      },
      attempts_used: 0,
      remaining_attempts: 2,
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'demo-account-7' })
        .props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      await renderer.root.findByType(Button).props.onPress();
    });

    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'WakeNotification', params: { requestId: 42 } },
      ],
    });
    expect(WakeAlarm.start).toHaveBeenCalledWith(42);
    expect(mockNavigate).not.toHaveBeenCalledWith('Home');
  });

  it('keeps Home navigation when pending recovery fails', async () => {
    jest.mocked(nunnunApi.wake.getPendingRequest).mockRejectedValue(
      new Error('network failure'),
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'demo-account-7' })
        .props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      await renderer.root.findByType(Button).props.onPress();
    });

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  });

  it('does not submit before an account is selected', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    expect(renderer.root.findByType(Button).props.onPress).toBeUndefined();
    expect(nunnunApi.auth.demoLogin).not.toHaveBeenCalled();
  });
});
