import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { ArrowLeft, User, Inbox, Send } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { Avatar } from '../../components/Avatar';
import { apiClient } from '../../api/client';

export const MessageRequestsScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDarkMode } = useBrutalistTheme();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/requests/pending');
      const data = res.data || {};
      
      const incoming = (data.incoming || []).map((r: any) => ({
        ...r,
        type: 'INCOMING',
        peer: r.sender,
      }));
      
      const outgoing = (data.outgoing || []).map((r: any) => ({
        ...r,
        type: 'OUTGOING',
        peer: r.receiver,
      }));

      setRequests([...incoming, ...outgoing]);
    } catch (err) {
      console.error('Fetch requests error:', err);
      Alert.alert('ERROR', 'UNABLE TO RETRIEVE MESSAGE REQUESTS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await apiClient.post('/requests/respond', {
        requestId,
        status: accept ? 'ACCEPTED' : 'DECLINED',
      });
      Alert.alert('SUCCESS', accept ? 'MESSAGE REQUEST ACCEPTED.' : 'MESSAGE REQUEST DECLINED.');
      fetchRequests();
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO RESPOND TO REQUEST');
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await apiClient.post('/requests/cancel', { requestId });
      Alert.alert('SUCCESS', 'OUTGOING MESSAGE REQUEST CANCELLED.');
      fetchRequests();
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO CANCEL REQUEST');
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'incoming') {
      return r.receiverId !== r.senderId; // Filter logic for incoming vs outgoing
    }
    return true;
  });

  // For testing, split by client identity checks
  const incomingList = requests.filter((r) => r.type === 'INCOMING');
  const outgoingList = requests.filter((r) => r.type === 'OUTGOING');
  const activeList = activeTab === 'incoming' ? incomingList : outgoingList;

  const renderRequestItem = ({ item }: { item: any }) => {
    const peer = item.peer;
    if (!peer) return null;

    return (
      <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.requestCard}>
        <View style={styles.cardRow}>
          <Avatar name={peer.displayName || peer.username} uri={peer.avatarUrl} size={44} />
          
          <View style={styles.peerInfo}>
            <Text style={[styles.displayName, { color: colors.textPrimary }]}>{peer.displayName?.toUpperCase()}</Text>
            <Text style={[styles.username, { color: colors.textSecondary }]}>@{peer.username.toLowerCase()}</Text>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
              SENT: {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {activeTab === 'incoming' ? (
            <View style={styles.btnRow}>
              <BrutalistButton
                onPress={() => handleRespond(item.id, true)}
                style={styles.actionBtn}
                accentColor={colors.green}
                textStyle={{ fontSize: 10 }}
                title="OK"
              />
              <BrutalistButton
                onPress={() => handleRespond(item.id, false)}
                style={styles.actionBtn}
                accentColor={colors.red}
                textStyle={{ fontSize: 10, color: '#FFFFFF' }}
                title="DECLINE"
              />
            </View>
          ) : (
            <BrutalistButton
              onPress={() => handleCancel(item.id)}
              style={styles.cancelBtn}
              accentColor={colors.yellow}
              textStyle={{ fontSize: 10 }}
              title="CANCEL"
            />
          )}
        </View>
      </BrutalistCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Header Bar */}
      <View style={styles.header}>
        <BrutalistButton onPress={() => navigation.goBack()} style={styles.backBtn} accentColor={colors.yellow}>
          <ArrowLeft size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </BrutalistButton>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>MESSAGE REQUESTS</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab select bar */}
      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('incoming')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'incoming' ? colors.yellow : colors.cardBg,
              borderRightWidth: BRUTALIST_STYLES.borderWidthThin,
              borderRightColor: colors.border,
            }
          ]}
        >
          <Inbox size={14} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, { color: colors.textPrimary }]}>INCOMING ({incomingList.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('outgoing')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'outgoing' ? colors.yellow : colors.cardBg,
            }
          ]}
        >
          <Send size={14} color={isDarkMode ? '#FFFFFF' : '#000000'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, { color: colors.textPrimary }]}>OUTGOING ({outgoingList.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Requests list container */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textPrimary} size="large" />
          </View>
        ) : (
          <FlatList
            data={activeList}
            keyExtractor={(item) => item.id}
            renderItem={renderRequestItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <BrutalistCard accentColor={colors.blue} padding={20}>
                  <View style={{ alignItems: 'center' }}>
                    <Inbox size={28} color="#FFFFFF" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>NO REQUESTS PENDING</Text>
                    <Text style={styles.emptySub}>
                      Your incoming and outgoing E2EE channels are clean.
                    </Text>
                  </View>
                </BrutalistCard>
              </View>
            }
          />
        )}
      </View>
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
    marginBottom: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: '#000000',
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  listContent: {
    paddingBottom: 40,
  },
  requestCard: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  displayName: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  username: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 1,
  },
  dateLabel: {
    fontSize: 8,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#888888',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  cancelBtn: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#EEEEEE',
    marginTop: 6,
    textAlign: 'center',
  },
});
