import React from 'react';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import PersonalGroupScreen from '../index';
import { nunnunApi } from '../../../api';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  CommonActions: { reset: jest.fn() },
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), dispatch: jest.fn() }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

jest.mock('../../../api', () => ({
  ApiError: class ApiError extends Error {},
  nunnunApi: {
    user: { getMe: jest.fn() },
    me: { getStats: jest.fn() },
    schedule: { list: jest.fn(), create: jest.fn() },
    dnd: { list: jest.fn(), create: jest.fn() },
    auth: { logout: jest.fn() },
  },
}));

const pressText = (root: ReactTestRenderer.ReactTestInstance, label: string) => {
  const text = root.findAllByType(Text).find(node => node.props.children === label);
  if (!text) throw new Error(`Text not found: ${label}`);
  let pressable = text.parent;
  while (pressable && typeof pressable.props.onPress !== 'function') {
    pressable = pressable.parent;
  }
  if (!pressable) throw new Error(`Pressable not found: ${label}`);
  pressable.props.onPress();
};

describe('PersonalGroup DND flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (nunnunApi.user.getMe as jest.Mock).mockResolvedValue({ nickname: '눈눈' });
    (nunnunApi.me.getStats as jest.Mock).mockResolvedValue({
      streak_days: 1,
      success_rate: 100,
    });
    (nunnunApi.schedule.list as jest.Mock).mockResolvedValue([]);
    (nunnunApi.dnd.list as jest.Mock)
      .mockResolvedValueOnce({ windows: [] })
      .mockResolvedValueOnce({
        windows: [{
          id: 1,
          day_of_week: 'MONDAY',
          start_time: '09:00',
          end_time: '10:00',
          display_text: '월요일, 09:00~10:00',
        }],
      });
    (nunnunApi.dnd.create as jest.Mock).mockResolvedValue({});
  });

  it('creates DND in the sheet, refreshes the list, and does not navigate', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PersonalGroupScreen />);
    });

    act(() => pressText(renderer.root, '방해금지 시간대'));
    act(() => pressText(renderer.root, '방해금지 시간대 추가하기'));

    const inputs = renderer.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText('09:00');
      inputs[1].props.onChangeText('10:00');
    });
    await act(async () => {
      const save = renderer.root
        .findAllByType(TouchableOpacity)
        .find(node => node.props.accessibilityLabel === '방해금지 시간 저장');
      await save?.props.onPress();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('DndWindows');
    expect(nunnunApi.dnd.create).toHaveBeenCalledTimes(1);
    expect(nunnunApi.dnd.create).toHaveBeenCalledWith('월요일, 09:00~10:00');
    expect(nunnunApi.dnd.list).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByProps({ visible: true })).toHaveLength(0);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === '1개 적용 중이에요')).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === '월요일 09:00~10:00')).toBe(true);
  });

  it('prevents duplicate submit while saving', async () => {
    let resolveCreate!: () => void;
    (nunnunApi.dnd.create as jest.Mock).mockImplementation(
      () => new Promise<void>(resolve => { resolveCreate = resolve; }),
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PersonalGroupScreen />);
    });
    act(() => pressText(renderer.root, '방해금지 시간대'));
    act(() => pressText(renderer.root, '방해금지 시간대 추가하기'));
    const inputs = renderer.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText('09:00');
      inputs[1].props.onChangeText('10:00');
    });
    const save = renderer.root
      .findAllByType(TouchableOpacity)
      .find(node => node.props.accessibilityLabel === '방해금지 시간 저장');

    let firstSubmit!: Promise<void>;
    act(() => {
      firstSubmit = save?.props.onPress();
      save?.props.onPress();
    });
    expect(nunnunApi.dnd.create).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreate();
      await firstSubmit;
    });
  });

  it('keeps the sheet open and alerts when create fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (nunnunApi.dnd.create as jest.Mock).mockRejectedValue(new Error('failed'));
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PersonalGroupScreen />);
    });
    act(() => pressText(renderer.root, '방해금지 시간대'));
    act(() => pressText(renderer.root, '방해금지 시간대 추가하기'));
    const inputs = renderer.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText('09:00');
      inputs[1].props.onChangeText('10:00');
    });
    await act(async () => {
      const save = renderer.root
        .findAllByType(TouchableOpacity)
        .find(node => node.props.accessibilityLabel === '방해금지 시간 저장');
      await save?.props.onPress();
    });

    expect(alert).toHaveBeenCalledWith('저장 실패', '방해금지 시간을 저장하지 못했어요.');
    expect(renderer.root.findAllByProps({ visible: true }).length).toBeGreaterThan(0);
    alert.mockRestore();
  });

  it('shows logout and stats without the detailed settings entry', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<PersonalGroupScreen />);
    });

    act(() => pressText(renderer.root, '설정'));
    const labels = renderer.root
      .findAllByType(Text)
      .map(node => node.props.children)
      .filter(value => typeof value === 'string');

    expect(labels).toContain('로그아웃');
    expect(labels).toContain('기상 통계');
    expect(labels).not.toContain('상세 설정');

    act(() => pressText(renderer.root, '로그아웃'));
    expect(renderer.root.findAllByProps({ visible: true }).length).toBeGreaterThan(0);
    act(() => pressText(renderer.root, '기상 통계'));
    expect(mockNavigate).toHaveBeenCalledWith('Stats');
    expect(mockNavigate).not.toHaveBeenCalledWith('Settings');
  });
});
