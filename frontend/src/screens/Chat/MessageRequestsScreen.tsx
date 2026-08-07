import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { ArrowLeft, User, Inbox, Send } from 'lucide-react-native';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroPanel } from '../../components/RetroPanel';
import { Avatar } from '../../components/Avatar';
import { COLORS } from '../../theme/colors';
import { RETRO_COLORS } from '../../theme/retroTheme';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';

export const MessageRequestsScreen: React.FC<any> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { fetchChats, setActiveChat } = useChatStore();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/requests/pending');
      setIncoming(res.data.incoming || []);
      setOutgoing(res.data.outgoing || []);
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      setLoading(true);
      const res = await apiClient.post('/requests/respond', { requestId, action });
      Alert.alert(
        action === 'accept' ? 'REQUEST ACCEPTED' : 'REQUEST DECLINED',
        res.data.message.toUpperCase()
      );
      await fetchRequests();
      
      if (action === 'accept' && res.data.chatId) {
        await fetchChats();
        setActiveChat(res.data.chatId);
        // Find sender details
        const reqItem = incoming.find((r) => r.id === requestId);
        const name = reqItem?.sender?.displayName || 'Chat';
        const peerUsername = reqItem?.sender?.username;
        navigation.replace('Chat', { chatId: res.data.chatId, name, peerUsername });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'FAILED TO RESPOND TO REQUEST';
      Alert.alert('ERROR', msg.toUpperCase());
      setLoading(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      setLoading(true);
      const res = await apiClient.delete(`/requests/cancel/${requestId}`);
      Alert.alert('REQUEST CANCELLED', res.data.message.toUpperCase());
      await fetchRequests();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'FAILED TO CANCEL REQUEST';
      Alert.alert('ERROR', msg.toUpperCase());
      setLoading(false);
    }
  };

  const renderIncomingItem = ({ item }: { item: any }) => (
    <RetroPanel style={styles.card} raised>
      <View style={styles.row}>
        <Avatar name={item.sender?.displayName} uri={item.sender?.avatarUrl} size={40} />
        <View style={styles.info}>
          <Text style={styles.displayName}>{item.sender?.displayName?.toUpperCase()}</Text>
          <Text style={styles.username}>@{item.sender?.username?.toLowerCase()}</Text>
        </View>
      </View>
      <View style={styles.btnRow}>
        <RetroButton
          title="ACCEPT"
          onPress={() => handleRespond(item.id, 'accept')}
          style={styles.acceptBtn}
        />
        <RetroButton
          title="DECLINE"
          onPress={() => handleRespond(item.id, 'decline')}
          style={styles.declineBtn}
        />
      </View>
    </RetroPanel>
  );

  const renderOutgoingItem = ({ item }: { item: any }) => (
    <RetroPanel style={styles.card} raised>
      <View style={styles.row}>
        <Avatar name={item.receiver?.displayName} uri={item.receiver?.avatarUrl} size={40} />
        <View style={styles.info}>
          <Text style={styles.displayName}>{item.receiver?.displayName?.toUpperCase()}</Text>
          <Text style={styles.username}>@{item.receiver?.username?.toLowerCase()}</Text>
        </View>
        <RetroButton
          title="CANCEL"
          onPress={() => handleCancel(item.id)}
          style={styles.cancelBtn}
        />
      </View>
    </RetroPanel>
  );

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      
      <RetroWindow
        title="MESSAGE_REQUESTS.EXE"
        onClose={() => navigation.goBack()}
        contentStyle={styles.windowContent}
      >
        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab('incoming')}
            style={[styles.tabBtn, activeTab === 'incoming' && styles.activeTabBtn]}
          >
            <Inbox size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={[styles.tabBtnText, activeTab === 'incoming' && styles.activeTabBtnText]}>
              INCOMING ({incoming.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('outgoing')}
            style={[styles.tabBtn, activeTab === 'outgoing' && styles.activeTabBtn]}
          >
            <Send size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={[styles.tabBtnText, activeTab === 'outgoing' && styles.activeTabBtnText]}>
              OUTGOING ({outgoing.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={activeTab === 'incoming' ? incoming : outgoing}
            keyExtractor={(item) => item.id}
            renderItem={activeTab === 'incoming' ? renderIncomingItem : renderOutgoingItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>NO MESSAGE REQUESTS FOUND</Text>
              </View>
            }
          />
        )}
      </RetroWindow>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RETRO_COLORS.desktop,
    padding: 8,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 34 : 20,
  },
  windowContent: {
    flex: 1,
    padding: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: RETRO_COLORS.panelDark,
    paddingBottom: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#c0c0c0',
    borderWidth: 1,
    borderColor: '#808080',
  },
  activeTabBtn: {
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    borderColor: '#0a0a0a',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#333',
  },
  activeTabBtnText: {
    color: '#000',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    marginBottom: 8,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  username: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#d4d0c8',
    borderColor: '#008000',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  declineBtn: {
    backgroundColor: '#d4d0c8',
    borderColor: '#800000',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cancelBtn: {
    backgroundColor: '#d4d0c8',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
});
