import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, Image, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Search, Plus, Phone, User as UserIcon, Settings as SettingsIcon, Mail, Music, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroTextInput } from '../../components/RetroTextInput';
import { RetroPanel } from '../../components/RetroPanel';
import { Avatar } from '../../components/Avatar';
import { UpdateModal } from '../../components/UpdateModal';
import { RETRO_COLORS, RETRO_STYLES } from '../../theme/retroTheme';
import { useChatStore, ChatItem } from '../../store/chatStore';
import { useMusicStore } from '../../store/musicStore';

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [callsList, setCallsList] = useState<any[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const { chats, fetchChats, setActiveChat, onlineUsers, initWsListeners } = useChatStore();
  const { currentTrack, isPlaying, pauseTrack, resumeTrack } = useMusicStore();

  useEffect(() => {
    fetchChats();
    initWsListeners();

    // Prompt for notification permissions on Android 13+
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

  const fetchCallHistory = async () => {
    try {
      setLoadingCalls(true);
      setShowCallsModal(true);
      const res = await apiClient.get('/calls/history');
      setCallsList(res.data || []);
    } catch (err) {
      console.error('Fetch calls error:', err);
      Alert.alert('ERROR', 'UNABLE TO RETRIEVE CALL HISTORY');
    } finally {
      setLoadingCalls(false);
    }
  };

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
        activeOpacity={0.8}
        onPress={() => {
          setActiveChat(item.id);
          navigation.navigate('Chat', { chatId: item.id, name: item.name, peerUsername: item.peerUsername });
        }}
      >
        <RetroPanel raised={false} style={styles.chatCard}>
          <View style={styles.row}>
            <Avatar name={item.name} uri={item.avatar} isOnline={isOnline} size={42} />

            <View style={styles.chatInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.chatName}>{item.name.toUpperCase()}</Text>
                <Text style={styles.timeText}>{lastMsgTime}</Text>
              </View>

              <View style={styles.subRow}>
                {item.peerUsername ? (
                  <Text style={styles.handleText}>@{item.peerUsername.toLowerCase()}</Text>
                ) : (
                  <Text style={styles.handleText}>SECURED GROUP ROUTE</Text>
                )}
                {item.lastMessage && (
                  <Text style={styles.lastMsgPreview} numberOfLines={1}>
                    {item.lastMessage.encryptedContent}
                  </Text>
                )}
              </View>
            </View>
            <ArrowRight size={14} color="#808080" />
          </View>
        </RetroPanel>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      <RetroWindow
        title="CONVERSATIONS.EXE"
        showControls={false}
        contentStyle={styles.windowContent}
        style={styles.mainWindow}
      >
        {/* Upper Menu Actions Panel */}
        <View style={styles.actionToolbar}>
          <View style={styles.leftToolbar}>
            <Image
              source={require('../../../assets/uschatlogo-trans.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.toolbarTitle}>USCHAT SECURE</Text>
              <Text style={styles.toolbarSub}>ONLINE / E2EE ACTIVE</Text>
            </View>
          </View>
          
          <View style={styles.rightToolbar}>
            <RetroButton onPress={() => navigation.navigate('Music')} style={styles.iconBtn}>
              <Music size={14} color="#000" />
            </RetroButton>
            <RetroButton onPress={() => navigation.navigate('MessageRequests')} style={styles.iconBtn}>
              <Mail size={14} color="#000" />
            </RetroButton>
            <RetroButton onPress={fetchCallHistory} style={styles.iconBtn}>
              <Phone size={14} color="#000" />
            </RetroButton>
            <RetroButton onPress={() => navigation.navigate('Profile')} style={styles.iconBtn}>
              <UserIcon size={14} color="#000" />
            </RetroButton>
            <RetroButton onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
              <SettingsIcon size={14} color="#000" />
            </RetroButton>
          </View>
        </View>

        {/* Search Panel */}
        <View style={styles.searchRow}>
          <RetroTextInput
            placeholder="SEARCH BY HANDLE OR NAME..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Search size={16} color="#808080" />}
            containerStyle={{ flex: 1 }}
          />
          <RetroButton
            onPress={() => navigation.navigate('CreateChat')}
            style={{ marginLeft: 6 }}
          >
            <Plus size={14} color="#000" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>ADD</Text>
          </RetroButton>
        </View>

        {/* Sunken list content area */}
        <RetroPanel raised={false} style={styles.listContainerPanel}>
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => item.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ShieldCheck size={28} color="#808080" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>NO CONVERSATIONS ROUTED</Text>
                <Text style={styles.emptySubtitle}>TAP [+] TO ESTABLISH AN E2EE DM OR GROUP ROUTE.</Text>
              </View>
            }
          />
        </RetroPanel>
      </RetroWindow>

      {/* Mini Music Player Dock */}
      {currentTrack && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Music')}
          style={styles.miniPlayerDock}
        >
          <RetroPanel raised style={styles.miniPlayerPanel}>
            <View style={styles.miniPlayerRow}>
              <Music size={14} color="#000" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                  {currentTrack.title.toUpperCase()}
                </Text>
                <Text style={styles.miniPlayerArtist} numberOfLines={1}>
                  {currentTrack.artist}
                </Text>
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  isPlaying ? pauseTrack() : resumeTrack();
                }}
                style={styles.miniPlayerPlayBtn}
              >
                {isPlaying ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>PLAY</Text>
                )}
              </TouchableOpacity>
            </View>
          </RetroPanel>
        </TouchableOpacity>
      )}

      {/* Call History Modal */}
      <Modal
        visible={showCallsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCallsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <RetroWindow
            title="CALL_HISTORY.EXE"
            onClose={() => setShowCallsModal(false)}
            style={{ width: 320, maxHeight: 420 }}
          >
            {loadingCalls ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={RETRO_COLORS.primary} size="large" />
              </View>
            ) : (
              <FlatList
                data={callsList}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 6 }}
                renderItem={({ item }) => (
                  <RetroPanel raised={false} style={styles.modalCallCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.callInitiatorText}>
                        {item.callerId === item.userId ? 'OUTGOING CALL' : 'INCOMING CALL'}
                      </Text>
                      <Text style={styles.callDateText}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                      <Text style={styles.callStatusText}>
                        STATUS: {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </RetroPanel>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={styles.emptyText}>NO RECENT CALL HISTORY</Text>
                  </View>
                }
              />
            )}
          </RetroWindow>
        </View>
      </Modal>

      <UpdateModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RETRO_COLORS.desktop,
    padding: 6,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 34 : 20,
  },
  mainWindow: {
    flex: 1,
  },
  windowContent: {
    flex: 1,
    padding: 6,
  },
  actionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: RETRO_COLORS.windowBackground,
    padding: 6,
    borderBottomWidth: 2,
    borderBottomColor: RETRO_COLORS.panelDark,
    marginBottom: 8,
  },
  leftToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  toolbarTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  toolbarSub: {
    fontSize: 8,
    fontFamily: 'monospace',
    color: '#008000',
    marginTop: 1,
  },
  rightToolbar: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 26,
    height: 24,
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  addBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  listContainerPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderTopColor: RETRO_COLORS.panelDark,
    borderLeftColor: RETRO_COLORS.panelDark,
    borderRightColor: RETRO_COLORS.panelLight,
    borderBottomColor: RETRO_COLORS.panelLight,
    padding: 4,
  },
  listContent: {
    paddingBottom: 80,
  },
  chatCard: {
    marginBottom: 6,
    padding: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  timeText: {
    color: '#808080',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  handleText: {
    color: '#555',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  lastMsgPreview: {
    color: '#808080',
    fontSize: 9,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#555',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#808080',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13,
    fontFamily: 'monospace',
  },
  miniPlayerDock: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 99,
  },
  miniPlayerPanel: {
    padding: 6,
  },
  miniPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniPlayerTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000000',
  },
  miniPlayerArtist: {
    fontSize: 7,
    fontFamily: 'monospace',
    color: '#555555',
    marginTop: 1,
  },
  miniPlayerPlayBtn: {
    width: 36,
    height: 20,
    backgroundColor: '#d4d0c8',
    borderWidth: 1,
    borderColor: '#808080',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCallCard: {
    marginBottom: 6,
    padding: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d4d0c8',
  },
  callInitiatorText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  callDateText: {
    color: '#555',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  callStatusText: {
    color: '#808080',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  emptyText: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
});
