import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { ArrowLeft, Search, UserPlus } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { GlassInput } from '../../components/GlassInput';
import { Avatar } from '../../components/Avatar';
import { COLORS } from '../../theme/colors';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../store/chatStore';

export const CreateChatScreen: React.FC<any> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const { setActiveChat, fetchChats } = useChatStore();

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }

    try {
      const res = await apiClient.get(`/users/search?q=${encodeURIComponent(text)}`);
      setResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const startChat = async (recipientUsername: string, displayName: string) => {
    try {
      const res = await apiClient.post('/chats/direct', { recipientUsername });
      await fetchChats();
      setActiveChat(res.data.id);
      navigation.replace('Chat', { chatId: res.data.id, name: displayName, peerUsername: recipientUsername });
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO START CHAT');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NEW SECURED ROUTE</Text>
      </View>

      <View style={styles.searchBox}>
        <GlassInput
          placeholder="SEARCH BY UNIQUE @USERNAME HANDLE..."
          value={query}
          onChangeText={handleSearch}
          icon={<Search size={18} color="#FFFFFF" />}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => startChat(item.username, item.displayName)}>
            <GlassCard style={styles.userCard}>
              <View style={styles.row}>
                <Avatar name={item.displayName} uri={item.avatarUrl} size={46} />
                <View style={styles.info}>
                  <Text style={styles.displayName}>{item.displayName.toUpperCase()}</Text>
                  <Text style={styles.username}>@{item.username.toLowerCase()}</Text>
                </View>
                <View style={styles.actionIconBox}>
                  <UserPlus size={20} color="#FFFFFF" />
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  searchBox: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  userCard: {
    marginBottom: 14,
    padding: 14,
    borderWidth: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  username: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
