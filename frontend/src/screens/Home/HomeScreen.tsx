import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, Image, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Search, Plus, Lock, Phone, User as UserIcon, Settings as SettingsIcon, ShieldCheck, X, Calendar } from 'lucide-react-native';
import { apiClient } from '../../api/client';
import { GlassCard } from '../../components/GlassCard';
import { GlassInput } from '../../components/GlassInput';
import { Avatar } from '../../components/Avatar';
import { UpdateModal } from '../../components/UpdateModal';
import { COLORS } from '../../theme/colors';
import { useChatStore, ChatItem } from '../../store/chatStore';

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [callsList, setCallsList] = useState<any[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const { chats, fetchChats, setActiveChat, onlineUsers, initWsListeners } = useChatStore();

  useEffect(() => {
    fetchChats();
    initWsListeners();
  }, []);

  const fetchCallHistory = async () => {
    try {
      setLoadingCalls(true);
      setShowCallsModal(true);
      const res = await apiClient.get('/calls/history');
      setCallsList(res.data);
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
        <GlassCard style={styles.chatCard}>
          <View style={styles.row}>
            <Avatar name={item.name} uri={item.avatar} isOnline={isOnline} size={50} />

            <View style={styles.chatInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.chatName}>{item.name.toUpperCase()}</Text>
                <Text style={styles.timeText}>{lastMsgTime}</Text>
              </View>

              <View style={styles.subRow}>
                {item.peerUsername ? (
                  <Text style={styles.handleText}>@{item.peerUsername.toLowerCase()}</Text>
                ) : (
                  <Text style={styles.handleText}>SECURED STORAGE</Text>
                )}
              </View>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Phone Status Bar Notch Clearance Spacer */}
      <View style={styles.statusBarSpacer} />

      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <View style={styles.brandBadge}>
            <Image
              source={require('../../../assets/uschatlogo-trans.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>USCHAT</Text>
            <Text style={styles.headerSubtitle}>ONLINE / SECURED</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={fetchCallHistory} style={styles.iconBtn}>
            <Phone size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.iconBtn}>
            <UserIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
            <SettingsIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <GlassInput
          placeholder="SEARCH BY HANDLE OR NAME..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Search size={18} color="#FFFFFF" />}
        />
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Lock size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.emptyTitle}>NO ACTIVE CONVERSATIONS</Text>
            <Text style={styles.emptySubtitle}>START A NEW CHAT BY GENERATING A SECURED ROUTE BELOW.</Text>
          </View>
        }
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CreateChat')}
        style={styles.fab}
      >
        <Plus size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Call History Modal */}
      <Modal
        visible={showCallsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCallsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Phone size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.modalTitle}>CALL HISTORY</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCallsModal(false)} style={styles.closeBtn}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* List content */}
          {loadingCalls ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={callsList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const dateStr = new Date(item.startedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <GlassCard style={styles.modalCallCard}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.callInitiatorText} numberOfLines={1}>
                        {item.initiator?.displayName?.toUpperCase() || item.initiator?.username?.toUpperCase() || 'SECURED CALL'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <Calendar size={12} color="#A1A1AA" style={{ marginRight: 6 }} />
                        <Text style={styles.callDateText}>{dateStr.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.callTypeText}>
                        {item.type}
                      </Text>
                      <Text style={styles.callStatusText}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </GlassCard>
                );
              }}
              ListEmptyComponent={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
                  <Text style={{ color: '#71717A', fontSize: 14, fontWeight: '700' }}>NO RECENT CALLS</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      <UpdateModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 52 : 28,
    backgroundColor: '#121212',
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: 20,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    padding: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 0,
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  chatCard: {
    marginBottom: 16,
    padding: 16,
    borderWidth: 2.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  handleText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#121212',
    padding: 30,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 0,
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 0,
    backgroundColor: COLORS.primary,
    borderColor: '#FFFFFF',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCallCard: {
    marginBottom: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  callInitiatorText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  callDateText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },
  callTypeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  callStatusText: {
    color: '#A1A1AA',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },
});
