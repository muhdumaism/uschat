import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, Image } from 'react-native';
import { Search, Plus, User as UserIcon, Settings as SettingsIcon, Mail, Music, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
import { Avatar } from '../../components/Avatar';
import { useChatStore, ChatItem } from '../../store/chatStore';
import { useMusicStore } from '../../store/musicStore';

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { chats, fetchChats, setActiveChat, onlineUsers, initWsListeners } = useChatStore();
  const { currentTrack, isPlaying, pauseTrack, resumeTrack } = useMusicStore();
  const { colors, isDarkMode } = useBrutalistTheme();

  useEffect(() => {
    fetchChats();
    initWsListeners();

    // Request notification permission
    const requestNotificationPermission = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const { PermissionsAndroid } = require('react-native');
        try {
          await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
        } catch (err) {
          console.warn('POST_NOTIFICATIONS permission request failed:', err);
        }
      }
    };
    requestNotificationPermission();
  }, []);

  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.peerUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const isOnline = item.peerUsername ? onlineUsers.has(item.peerUsername) : false;
    const lastMsgTime = item.updatedAt
      ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          setActiveChat(item.id);
          navigation.navigate('Chat', { chatId: item.id, name: item.name, peerUsername: item.peerUsername });
        }}
        style={{ marginBottom: 16 }}
      >
        <BrutalistCard
          accentColor={colors.cardBg}
          padding={16}
          contentStyle={styles.chatCardContent}
        >
          <View style={styles.chatRow}>
            {/* Overlapping/Offset Avatar */}
            <View style={styles.avatarWrapper}>
              <Avatar name={item.name} uri={item.avatar} isOnline={isOnline} size={52} />
            </View>

            <View style={styles.chatInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.chatName, { color: colors.textPrimary }]}>{item.name.toUpperCase()}</Text>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>{lastMsgTime}</Text>
              </View>

              <View style={styles.subRow}>
                {item.peerUsername ? (
                  <Text style={[styles.handleText, { color: colors.textMuted }]}>@{item.peerUsername.toLowerCase()}</Text>
                ) : (
                  <Text style={[styles.handleText, { color: colors.textMuted }]}>GROUP CHANNEL</Text>
                )}
                {item.lastMessage && (
                  <Text style={[styles.lastMsgPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.lastMessage.encryptedContent}
                  </Text>
                )}
              </View>
            </View>
            <ArrowRight size={20} color={colors.textPrimary} style={{ marginLeft: 6 }} />
          </View>
        </BrutalistCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Navigation Header */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../assets/uschatlogo-trans.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>USCHAT</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>ONLINE</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <BrutalistButton onPress={() => navigation.navigate('Music')} style={styles.iconBtn} accentColor={colors.yellow}>
            <Music size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />
          </BrutalistButton>
          <BrutalistButton onPress={() => navigation.navigate('MessageRequests')} style={styles.iconBtn} accentColor={colors.pink}>
            <Mail size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />
          </BrutalistButton>
          <BrutalistButton onPress={() => navigation.navigate('Profile')} style={styles.iconBtn} accentColor={colors.blue}>
            <UserIcon size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />
          </BrutalistButton>
          <BrutalistButton onPress={() => navigation.navigate('Settings')} style={styles.iconBtn} accentColor={colors.green}>
            <SettingsIcon size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} />
          </BrutalistButton>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchRow}>
        <BrutalistTextInput
          placeholder="SEARCH CHATS..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Search size={18} color={colors.textPrimary} />}
          containerStyle={{ flex: 1 }}
        />
        <BrutalistButton
          onPress={() => navigation.navigate('CreateChat')}
          style={styles.addBtn}
          accentColor={colors.yellow}
        >
          <Plus size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 4 }} />
          <Text style={[styles.addBtnText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>ADD</Text>
        </BrutalistButton>
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <BrutalistCard accentColor={colors.blue} padding={20}>
              <View style={{ alignItems: 'center' }}>
                <ShieldCheck size={32} color="#000000" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>NO ACTIVE CHANNELS</Text>
                <Text style={styles.emptySubtitle}>
                  TAP [ADD] TO INITIATE A NEW ENCRYPTED DM REQUEST OR GROUP.
                </Text>
              </View>
            </BrutalistCard>
          </View>
        }
      />

      {/* Brutalist Global Music Mini Player */}
      {currentTrack && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Music')}
          style={styles.miniPlayerDock}
        >
          <BrutalistCard accentColor={colors.green} padding={10}>
            <View style={styles.miniPlayerRow}>
              <Music size={16} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniPlayerTitle, { color: isDarkMode ? '#FFFFFF' : '#000000' }]} numberOfLines={1}>
                  {currentTrack.title.toUpperCase()}
                </Text>
                <Text style={[styles.miniPlayerArtist, { color: isDarkMode ? '#EEEEEE' : '#333333' }]} numberOfLines={1}>
                  {currentTrack.artist.toUpperCase()}
                </Text>
              </View>
              <BrutalistButton
                onPress={isPlaying ? pauseTrack : resumeTrack}
                style={styles.miniPlayerPlayBtn}
                accentColor={colors.yellow}
              >
                <Text style={[styles.miniPlayBtnText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
              </BrutalistButton>
            </View>
          </BrutalistCard>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRUTALIST_COLORS.background,
    paddingHorizontal: 16,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 44 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: BRUTALIST_COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 8,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: BRUTALIST_COLORS.textMuted,
    marginTop: -2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  addBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  listContent: {
    paddingBottom: 120,
  },
  chatCardContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 26,
    overflow: 'hidden',
  },
  chatInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  timeText: {
    color: '#555555',
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  handleText: {
    color: '#444444',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  lastMsgPreview: {
    color: '#666666',
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  emptyWrapper: {
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  emptySubtitle: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  miniPlayerDock: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 99,
  },
  miniPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniPlayerTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  miniPlayerArtist: {
    fontSize: 8,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#333333',
    marginTop: 1,
  },
  miniPlayerPlayBtn: {
    height: 32,
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 12,
  },
  miniPlayBtnText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
});
