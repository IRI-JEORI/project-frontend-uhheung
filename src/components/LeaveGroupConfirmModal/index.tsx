import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/Colors';

export interface LeaveGroupConfirmModalProps {
  visible: boolean;
  scale: number;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

const LeaveGroupConfirmModal = ({
  visible,
  scale,
  onCancel,
  onConfirm,
  submitting = false,
}: LeaveGroupConfirmModalProps) => (
  <Modal
    animationType="fade"
    onRequestClose={submitting ? () => undefined : onCancel}
    statusBarTranslucent
    transparent
    visible={visible}
  >
    <View style={styles.overlay}>
      <View
        style={[
          styles.panel,
          {
            width: 320 * scale,
            height: 315 * scale,
            borderRadius: 16 * scale,
          },
        ]}
      >
        <Image
          accessibilityLabel="그룹 나가기 경고"
          resizeMode="contain"
          source={require('../../assets/images/wake-caution.png')}
          style={{ width: 104 * scale, height: 104 * scale }}
        />
        <Text style={styles.title}>방에서 나갈까요?</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹에 남기"
            activeOpacity={0.8}
            disabled={submitting}
            onPress={onCancel}
            style={[styles.button, styles.cancelButton]}
          >
            <Text style={styles.cancelText}>아니요</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="그룹에서 나가기"
            activeOpacity={0.8}
            disabled={submitting}
            onPress={onConfirm}
            style={[styles.button, styles.confirmButton]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.textWhite} />
            ) : (
              <Text style={styles.confirmText}>예</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  panel: {
    alignItems: 'center',
    paddingTop: 46,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  title: {
    marginTop: 15,
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
  },
  actions: {
    position: 'absolute',
    right: 15,
    bottom: 42.5,
    left: 15,
    flexDirection: 'row',
    columnGap: 16,
  },
  button: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: Colors.gray,
  },
  confirmButton: {
    backgroundColor: '#FF4B4B',
  },
  cancelText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  confirmText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
});

export default LeaveGroupConfirmModal;
