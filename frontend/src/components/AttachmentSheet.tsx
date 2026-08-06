import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import {
  Camera,
  Image,
  Video,
  FileText,
  MapPin,
  User,
  X,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AttachmentOption {
  label: string;
  icon: React.ReactNode;
  value: string;
  color: string;
}

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: string) => void;
}

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const options: AttachmentOption[] = [
    {
      label: 'Camera',
      icon: <Camera size={24} color="#FFF" />,
      value: 'camera',
      color: '#E91E63',
    },
    {
      label: 'Photos',
      icon: <Image size={24} color="#FFF" />,
      value: 'photos',
      color: '#9C27B0',
    },
    {
      label: 'Video',
      icon: <Video size={24} color="#FFF" />,
      value: 'video',
      color: '#3F51B5',
    },
    {
      label: 'Document',
      icon: <FileText size={24} color="#FFF" />,
      value: 'document',
      color: '#009688',
    },
    {
      label: 'Location',
      icon: <MapPin size={24} color="#FFF" />,
      value: 'location',
      color: '#4CAF50',
    },
    {
      label: 'Contact',
      icon: <User size={24} color="#FFF" />,
      value: 'contact',
      color: '#FF9800',
    },
  ];

  const handlePressOption = (val: string) => {
    onSelectOption(val);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Share Content</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => handlePressOption(opt.value)}
              style={styles.optionItem}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: opt.color }]}>
                {opt.icon}
              </View>
              <Text style={styles.label}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionItem: {
    width: '30%',
    alignItems: 'center',
    marginVertical: 12,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    color: '#DDD',
    fontSize: 12,
    fontWeight: '500',
  },
});
