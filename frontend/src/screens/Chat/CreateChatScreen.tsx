import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { ArrowLeft, Search, UserPlus, Users, CheckSquare, Square } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
import { Avatar } from '../../components/Avatar';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';

export const CreateChatScreen: React.FC<any> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct');
  
  // Search details
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Group creation details
  const [groupName, setGroupName] = useState('');
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const { setActiveChat, fetchChats } = useChatStore();

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }

    try {
      setSearching(true);
      const res = await apiClient.get(`/users/search?q=${encodeURIComponent(text)}`);
      setResults(res.data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const startChat = async (recipientUsername: string) => {
    try {
      await apiClient.post('/requests/send', { receiverUsername: recipientUsername });
      Alert.alert('REQUEST SENT', `MESSAGE REQUEST SENT TO @${recipientUsername.toLowerCase()}.`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO SEND REQUEST');
    }
  };

  const toggleSelectMember = (username: string) => {
    if (selectedUsernames.includes(username)) {
      setSelectedUsernames(selectedUsernames.filter((u) => u !== username));
    } else {
      setSelectedUsernames([...selectedUsernames, username]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('VALIDATION ERROR', 'PLEASE ENTER A SECURED GROUP NAME.');
      return;
    }
    if (selectedUsernames.length === 0) {
      Alert.alert('VALIDATION ERROR', 'PLEASE SELECT AT LEAST ONE MEMBER.');
      return;
    }

    try {
      setCreating(true);
      const res = await apiClient.post('/chats/group', {
        name: groupName,
        memberUsernames: selectedUsernames,
      });
      await fetchChats();
      setActiveChat(res.data.id);
      navigation.replace('Chat', { chatId: res.data.id, name: groupName });
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO ESTABLISH GROUP ROUTE');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />
      
      {/* Header Bar */}
      <View style={styles.header}>
        <BrutalistButton onPress={() => navigation.goBack()} style={styles.backBtn} accentColor={BRUTALIST_COLORS.yellow}>
          <ArrowLeft size={18} color="#000000" />
        </BrutalistButton>
        <Text style={styles.headerTitle}>NEW ROUTE</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => { setActiveTab('direct'); setResults([]); setQuery(''); }}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'direct' ? BRUTALIST_COLORS.yellow : '#FFFFFF',
              borderRightWidth: BRUTALIST_STYLES.borderWidthThin,
            }
          ]}
        >
          <UserPlus size={16} color="#000000" style={{ marginRight: 6 }} />
          <Text style={styles.tabText}>DIRECT E2EE</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => { setActiveTab('group'); setResults([]); setQuery(''); }}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'group' ? BRUTALIST_COLORS.yellow : '#FFFFFF',
            }
          ]}
        >
          <Users size={16} color="#000000" style={{ marginRight: 6 }} />
          <Text style={styles.tabText}>GROUP CHAT</Text>
        </TouchableOpacity>
      </View>

      {/* Group Info Input Field */}
      {activeTab === 'group' && (
        <BrutalistCard accentColor={BRUTALIST_COLORS.cardBg} padding={12} style={styles.groupMetaBox}>
          <Text style={styles.label}>SECURED GROUP NAME</Text>
          <BrutalistTextInput
            placeholder="ENTER SECURED ROUTE TITLE..."
            value={groupName}
            onChangeText={setGroupName}
            containerStyle={{ marginBottom: 10 }}
          />
          <Text style={styles.selectedCountText}>
            MEMBERS SELECTED: {selectedUsernames.length}
          </Text>
        </BrutalistCard>
      )}

      {/* Search Input Bar */}
      <View style={styles.searchRow}>
        <BrutalistTextInput
          placeholder="SEARCH BY HANDLE OR @USERNAME..."
          value={query}
          onChangeText={handleSearch}
          icon={<Search size={18} color="#000000" />}
          containerStyle={{ flex: 1 }}
        />
      </View>

      {/* Results Box */}
      <BrutalistCard accentColor="#FFFFFF" padding={12} style={{ flex: 1 }}>
        {searching ? (
          <View style={styles.center}>
            <ActivityIndicator color="#000000" size="large" />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isSelected = selectedUsernames.includes(item.username);
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    if (activeTab === 'direct') {
                      startChat(item.username);
                    } else {
                      toggleSelectMember(item.username);
                    }
                  }}
                  style={styles.userCard}
                >
                  <Avatar name={item.displayName} uri={item.avatarUrl} size={36} />
                  <View style={styles.userInfo}>
                    <Text style={styles.displayName}>{item.displayName.toUpperCase()}</Text>
                    <Text style={styles.username}>@{item.username.toLowerCase()}</Text>
                  </View>
                  
                  {activeTab === 'group' && (
                    <View style={styles.checkbox}>
                      {isSelected ? (
                        <CheckSquare size={22} color="#000000" />
                      ) : (
                        <Square size={22} color="#555555" />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>DIAL 2+ ALPHABETS TO ROUTE PEERS</Text>
              </View>
            }
          />
        )}
      </BrutalistCard>

      {/* Create Button Footer */}
      {activeTab === 'group' && (
        <View style={styles.createBtnWrapper}>
          {creating ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <BrutalistButton
              title="ESTABLISH GROUP ROUTE"
              onPress={handleCreateGroup}
              style={{ width: '100%' }}
              accentColor={BRUTALIST_COLORS.pink}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRUTALIST_COLORS.background,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    marginBottom: 12,
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
  groupMetaBox: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginBottom: 4,
  },
  selectedCountText: {
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    fontWeight: 'bold',
    color: BRUTALIST_COLORS.pink,
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  listContainer: {
    paddingBottom: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  username: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 2,
  },
  checkbox: {
    paddingLeft: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666666',
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    fontWeight: 'bold',
  },
  createBtnWrapper: {
    marginTop: 12,
    alignItems: 'center',
  },
});
