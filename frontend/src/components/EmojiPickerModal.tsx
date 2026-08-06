import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Search } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    ],
  },
  {
    name: 'Gestures',
    icon: '👍',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂',
    ],
  },
  {
    name: 'Nature',
    icon: '🐱',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
      '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️',
      '🦎', '🐙', '🦑', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛',
    ],
  },
  {
    name: 'Food',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒',
      '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🍳', '🥞', '🧇', '🥓', '🥩', '🍔', '🍟', '🍕', '🌭',
      '🍱', '🍣', '🍤', '🍜', '🍝', '🍲', '🥗', '🍿', '🍩', '🍪', '🎂', '🍰', '🍫', '🍬', '🍭', '🍯', '☕', '🍵', '🍻', '🥤',
    ],
  },
  {
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏒', '⛳', '🎯', '🥊', 'skateboard: 🛹', '⛷️', '🏂', '🏋️', '🤸',
      '🤺', '🏌️', '🏄', '🏊', '🚴', '🏆', '🥇', '🥈', '🥉', '🎫', '🎟️', '🎭', '🎨', '🎬', '🎤', '🎧', '🎸', '🎹', '🎮', '🎳',
    ],
  },
  {
    name: 'Objects',
    icon: '💡',
    emojis: [
      '⌚', '📱', '💻', '🖥️', '📷', '📸', '📹', '🎥', '📞', '📟', '📠', '📺', '📻', '🎙️', '🧭', '⏰', '⏳', '💵', '🪙', '💳',
      '✉️', '📦', '✏️', '✒️', '📝', '📁', '📂', '📅', '📊', '📋', '📌', '📎', '🔒', '🔓', '🔑', '🔨', '🛡️', '🔧', '💣', '💡',
    ],
  },
  {
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '☮️', '✝️',
      '☪️', '🕉️', '☸️', '✡️', '☯️', '☦️', '🛐', '🆔', '📴', '📳', '🔴', '🔵', '🟢', '🟡', '⚫', '⚪', '🏁', '🚩', '🏳️‍🌈', '🏴‍☠️',
    ],
  },
];

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  visible,
  onClose,
  onSelectEmoji,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Recent');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [filteredEmojis, setFilteredEmojis] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadRecentEmojis();
      setSearchQuery('');
      setSelectedCategory('Recent');
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const results: string[] = [];
      EMOJI_CATEGORIES.forEach((cat) => {
        cat.emojis.forEach((emoji) => {
          if (!results.includes(emoji)) {
            results.push(emoji);
          }
        });
      });
      const matches = results.slice(0, 150);
      setFilteredEmojis(matches);
    } else {
      setFilteredEmojis([]);
    }
  }, [searchQuery]);

  const loadRecentEmojis = async () => {
    try {
      const stored = await AsyncStorage.getItem('@uschat/recent_emojis');
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      } else {
        setRecentEmojis(['👍', '❤️', '😂', '🔥', '😊', '🙏', '🎉', '💡', '🎤']);
      }
    } catch (err) {
      console.warn('Failed to load recent emojis:', err);
    }
  };

  const saveRecentEmoji = async (emoji: string) => {
    try {
      const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, 36);
      setRecentEmojis(updated);
      await AsyncStorage.setItem('@uschat/recent_emojis', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save recent emoji:', err);
    }
  };

  const handleEmojiPress = (emoji: string) => {
    onSelectEmoji(emoji);
    saveRecentEmoji(emoji);
    onClose();
  };

  const getDisplayEmojis = () => {
    if (searchQuery.trim().length > 0) {
      return filteredEmojis;
    }
    if (selectedCategory === 'Recent') {
      return recentEmojis;
    }
    const cat = EMOJI_CATEGORIES.find((c) => c.name === selectedCategory);
    return cat ? cat.emojis : [];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Select Emoji</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Search size={16} color={COLORS.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search emojis..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
            </View>

            {searchQuery.trim().length === 0 && (
              <View style={styles.categoriesBar}>
                <TouchableOpacity
                  onPress={() => setSelectedCategory('Recent')}
                  style={[
                    styles.categoryTab,
                    selectedCategory === 'Recent' && styles.categoryTabActive,
                  ]}
                >
                  <Text style={styles.categoryIcon}>🕒</Text>
                </TouchableOpacity>
                {EMOJI_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setSelectedCategory(cat.name)}
                    style={[
                      styles.categoryTab,
                      selectedCategory === cat.name && styles.categoryTabActive,
                    ]}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.gridContainer}>
              <FlatList
                data={getDisplayEmojis()}
                keyExtractor={(item, index) => `${item}_${index}`}
                numColumns={8}
                columnWrapperStyle={styles.columnWrapper}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleEmojiPress(item)}
                    style={styles.emojiCell}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.emojiText}>{item}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No emojis found</Text>
                  </View>
                }
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    padding: 0,
  },
  categoriesBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
    paddingVertical: 6,
  },
  categoryTab: {
    padding: 8,
    borderRadius: 8,
  },
  categoryTabActive: {
    backgroundColor: '#303030',
  },
  categoryIcon: {
    fontSize: 18,
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  columnWrapper: {
    justifyContent: 'space-around',
    marginVertical: 4,
  },
  emojiCell: {
    width: SCREEN_WIDTH / 9,
    height: SCREEN_WIDTH / 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emojiText: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});
