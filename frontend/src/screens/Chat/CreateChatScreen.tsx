import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { ArrowLeft, Search, UserPlus, Users, CheckSquare, Square } from 'lucide-react-native';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroTextInput } from '../../components/RetroTextInput';
import { RetroPanel } from '../../components/RetroPanel';
import { Avatar } from '../../components/Avatar';
import { RETRO_COLORS } from '../../theme/retroTheme';
import { COLORS } from '../../theme/colors';
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
      <View style={styles.statusBarSpacer} />
      
      <RetroWindow
        title="CREATE_ROUTE.EXE"
        onClose={() => navigation.goBack()}
        contentStyle={styles.windowContent}
      >
        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => { setActiveTab('direct'); setResults([]); setQuery(''); }}
            style={[styles.tab, activeTab === 'direct' && styles.activeTab]}
          >
            <UserPlus size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.tabText}>DIRECT E2EE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setActiveTab('group'); setResults([]); setQuery(''); }}
            style={[styles.tab, activeTab === 'group' && styles.activeTab]}
          >
            <Users size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.tabText}>GROUP CHAT</Text>
          </TouchableOpacity>
        </View>

        {/* Tab content panel */}
        <RetroPanel style={styles.panelContent} raised={false}>
          {activeTab === 'group' && (
            <View style={styles.groupMetaBox}>
              <Text style={styles.label}>SECURED GROUP NAME</Text>
              <RetroTextInput
                placeholder="ENTER SECURED ROUTE TITLE..."
                value={groupName}
                onChangeText={setGroupName}
                containerStyle={{ marginBottom: 12 }}
              />
              <Text style={styles.selectedCountText}>
                MEMBERS SELECTED: {selectedUsernames.length}
              </Text>
            </View>
          )}

          {/* Search Box */}
          <View style={styles.searchRow}>
            <RetroTextInput
              placeholder="SEARCH BY HANDLE OR @USERNAME..."
              value={query}
              onChangeText={handleSearch}
              icon={<Search size={16} color="#808080" />}
              containerStyle={{ flex: 1 }}
            />
          </View>

          {searching ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.primary} size="large" />
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
                    activeOpacity={0.8}
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
                          <CheckSquare size={20} color="#000080" />
                        ) : (
                          <Square size={20} color="#808080" />
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
        </RetroPanel>

        {activeTab === 'group' && (
          <View style={styles.createBtnWrapper}>
            {creating ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <RetroButton title="ESTABLISH GROUP ROUTE" onPress={handleCreateGroup} style={{ width: '100%' }} />
            )}
          </View>
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
  tabBar: {
    flexDirection: 'row',
    marginBottom: 2,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: RETRO_COLORS.windowBackground,
    borderWidth: 2,
    borderTopColor: RETRO_COLORS.panelLight,
    borderLeftColor: RETRO_COLORS.panelLight,
    borderRightColor: RETRO_COLORS.panelDark,
    borderBottomColor: RETRO_COLORS.panelDark,
  },
  activeTab: {
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    borderTopColor: RETRO_COLORS.panelLight,
    borderLeftColor: RETRO_COLORS.panelLight,
    borderRightColor: RETRO_COLORS.panelDark,
  },
  tabText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000000',
  },
  panelContent: {
    flex: 1,
    padding: 8,
    borderWidth: 2,
    borderTopColor: RETRO_COLORS.panelDark,
    borderLeftColor: RETRO_COLORS.panelDark,
    borderRightColor: RETRO_COLORS.panelLight,
    borderBottomColor: RETRO_COLORS.panelLight,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  groupMetaBox: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d4d0c8',
    paddingBottom: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
    marginBottom: 4,
  },
  selectedCountText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#000080',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  username: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#808080',
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
    color: '#808080',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  createBtnWrapper: {
    marginTop: 8,
    alignItems: 'center',
  },
});
