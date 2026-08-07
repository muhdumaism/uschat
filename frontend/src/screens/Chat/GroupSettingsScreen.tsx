import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { ArrowLeft, User, UserCheck, ShieldCheck, Users, Edit3, Trash2, CheckCircle, Pin } from 'lucide-react-native';
import { BRUTALIST_COLORS, BRUTALIST_STYLES, useBrutalistTheme } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
import { Avatar } from '../../components/Avatar';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export const GroupSettingsScreen: React.FC<any> = ({ route, navigation }) => {
  const { colors, isDarkMode } = useBrutalistTheme();
  const { chatId, groupName } = route.params;
  const currentUser = useAuthStore((s) => s.user);

  const [chatDetails, setChatDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Edit configurations
  const [description, setDescription] = useState('');
  const [adminsOnlyMsg, setAdminsOnlyMsg] = useState(false);
  const [adminsOnlyEdit, setAdminsOnlyEdit] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Invite member configurations
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);

  // Pinned messages list
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [loadingPins, setLoadingPins] = useState(false);

  useEffect(() => {
    fetchDetails();
    fetchPins();
  }, []);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/chats/group/${chatId}`);
      setChatDetails(res.data);
      setDescription(res.data.description || '');
      setAdminsOnlyMsg(res.data.adminsOnlyMessaging || false);
      setAdminsOnlyEdit(res.data.adminsOnlyInfoEdit || false);
    } catch (e) {
      console.warn('Fetch details error:', e);
      Alert.alert('ERROR', 'UNABLE TO RETRIEVE GROUP METADATA.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPins = async () => {
    try {
      setLoadingPins(true);
      const res = await apiClient.get(`/chats/group/${chatId}/pins`);
      setPinnedMessages(res.data || []);
    } catch (e) {
      console.warn('Fetch pins error:', e);
    } finally {
      setLoadingPins(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await apiClient.patch(`/chats/group/${chatId}`, {
        description,
        adminsOnlyMessaging: adminsOnlyMsg,
        adminsOnlyInfoEdit: adminsOnlyEdit,
      });
      Alert.alert('SUCCESS', 'Group settings saved.');
      fetchDetails();
    } catch (e: any) {
      Alert.alert('ERROR', e.response?.data?.message?.toUpperCase() || 'FAILED TO SAVE SETTINGS.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddMember = async () => {
    if (!inviteUsername.trim()) return;
    try {
      setInviting(true);
      await apiClient.post(`/chats/group/${chatId}/members`, { username: inviteUsername.trim() });
      Alert.alert('SUCCESS', `Added @${inviteUsername.toLowerCase()} to the group.`);
      setInviteUsername('');
      fetchDetails();
    } catch (e: any) {
      Alert.alert('ERROR', e.response?.data?.message?.toUpperCase() || 'FAILED TO ADD MEMBER.');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: string) => {
    try {
      await apiClient.patch(`/chats/group/${chatId}/members/role`, {
        memberUserId,
        role: newRole,
      });
      Alert.alert('SUCCESS', 'MEMBER SECURITY PRIVILEGE UPDATED.');
      fetchDetails();
    } catch (e: any) {
      Alert.alert('ERROR', e.response?.data?.message?.toUpperCase() || 'PRIVILEGE MODIFICATION FAILED.');
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await apiClient.delete(`/chats/group/${chatId}/members/${memberUserId}`);
      Alert.alert('SUCCESS', 'Member removed from group.');
      fetchDetails();
    } catch (e: any) {
      Alert.alert('ERROR', e.response?.data?.message?.toUpperCase() || 'FAILED TO REMOVE MEMBER.');
    }
  };

  const handleLeaveGroup = async () => {
    Alert.alert('LEAVE GROUP', 'ARE YOU SURE YOU WANT TO LEAVE THIS GROUP?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'LEAVE',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/chats/group/${chatId}/leave`);
            navigation.popToTop();
          } catch (e) {
            Alert.alert('ERROR', 'FAILED TO LEAVE GROUP.');
          }
        },
      },
    ]);
  };

  if (loading || !chatDetails) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  // Find user's member model role
  const selfMember = chatDetails.members?.find((m: any) => m.userId === currentUser?.id);
  const isSelfAdmin = selfMember?.role === 'ADMIN' || selfMember?.role === 'OWNER';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Header Bar */}
      <View style={styles.header}>
        <BrutalistButton onPress={() => navigation.goBack()} style={styles.backBtn} accentColor={colors.yellow}>
          <ArrowLeft size={18} color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </BrutalistButton>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>GROUP CONFIG</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile/Metadata section */}
        <BrutalistCard accentColor={colors.cardBg} padding={16} style={styles.metaCard}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarBezel, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Avatar name={groupName} uri={chatDetails.avatar} size={72} />
            </View>
            <View style={styles.groupInfoBox}>
              <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>{groupName.toUpperCase()}</Text>
              <Text style={[styles.subText, { color: colors.textSecondary }]}>
                {chatDetails.members?.length || 0} MEMBERS
              </Text>
            </View>
          </View>
        </BrutalistCard>

        {/* Configurations Box */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>GROUP RULES</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.metaCard}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>DESCRIPTION / RULESET</Text>
          <BrutalistTextInput
            placeholder="ENTER DESCRIPTION..."
            value={description}
            onChangeText={setDescription}
            editable={isSelfAdmin || !adminsOnlyEdit}
            containerStyle={{ marginBottom: 12 }}
          />

          {isSelfAdmin && (
            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>ADMINS-ONLY MESSAGING</Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Restrict messaging privileges to admins.</Text>
              </View>
              <Switch
                value={adminsOnlyMsg}
                onValueChange={setAdminsOnlyMsg}
                trackColor={{ false: '#CCCCCC', true: colors.border }}
                thumbColor={adminsOnlyMsg ? colors.yellow : '#FFFFFF'}
              />
            </View>
          )}

          {isSelfAdmin && (
            <View style={[styles.switchRow, { marginTop: 10 }]}>
              <View style={styles.switchMeta}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>ADMINS-ONLY DETAILS EDIT</Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Restrict group description editing to admins.</Text>
              </View>
              <Switch
                value={adminsOnlyEdit}
                onValueChange={setAdminsOnlyEdit}
                trackColor={{ false: '#CCCCCC', true: colors.border }}
                thumbColor={adminsOnlyEdit ? colors.yellow : '#FFFFFF'}
              />
            </View>
          )}

          {(isSelfAdmin || !adminsOnlyEdit) && (
            <BrutalistButton
              title={savingSettings ? "SECURING..." : "SAVE GROUP RULES"}
              onPress={handleSaveSettings}
              style={{ marginTop: 12 }}
              accentColor={colors.yellow}
              disabled={savingSettings}
            />
          )}
        </BrutalistCard>

        {/* Member Add Card */}
        {isSelfAdmin && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>ADD MEMBER</Text>
            <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.metaCard}>
              <View style={styles.row}>
                <BrutalistTextInput
                  placeholder="USERNAME..."
                  value={inviteUsername}
                  onChangeText={setInviteUsername}
                  containerStyle={{ flex: 1, marginRight: 8 }}
                />
                <BrutalistButton
                  onPress={handleAddMember}
                  title={inviting ? "ADDING..." : "INVITE"}
                  accentColor={colors.pink}
                  disabled={inviting}
                />
              </View>
            </BrutalistCard>
          </>
        )}

        {/* Pins Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PINNED MESSAGES ({pinnedMessages.length})</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.metaCard}>
          {loadingPins ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            pinnedMessages.map((msg) => (
              <View key={msg.id} style={styles.pinRow}>
                <Pin size={14} color={colors.textPrimary} style={{ marginRight: 8 }} />
                <Text style={[styles.pinText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {msg.decryptedText || msg.encryptedContent}
                </Text>
              </View>
            ))
          )}
          {!loadingPins && pinnedMessages.length === 0 && (
            <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>NO PINNED MESSAGES IN THIS GROUP.</Text>
          )}
        </BrutalistCard>

        {/* Participant list card */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>MEMBERS</Text>
        <BrutalistCard accentColor={colors.cardBg} padding={12} style={styles.metaCard}>
          {chatDetails.members?.map((m: any) => {
            const isAdmin = m.role === 'ADMIN' || m.role === 'OWNER';
            const isSelf = m.userId === currentUser?.id;
            
            return (
              <View key={m.id} style={[styles.memberItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Avatar name={m.user?.displayName || m.user?.username} uri={m.user?.avatarUrl} size={36} />
                <View style={styles.memberMeta}>
                  <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                    {(m.user?.displayName || m.user?.username).toUpperCase()}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                    ROLE: {m.role} {isSelf && '(YOU)'}
                  </Text>
                </View>

                {isSelfAdmin && !isSelf && m.role !== 'OWNER' && (
                  <View style={styles.memberActions}>
                    {isAdmin ? (
                      <BrutalistButton
                        onPress={() => handleUpdateRole(m.userId, 'MEMBER')}
                        style={styles.memberActionBtn}
                        accentColor={colors.blue}
                        title="DEMOTE"
                      />
                    ) : (
                      <BrutalistButton
                        onPress={() => handleUpdateRole(m.userId, 'ADMIN')}
                        style={styles.memberActionBtn}
                        accentColor={colors.yellow}
                        title="PROMOTE"
                      />
                    )}
                    <BrutalistButton
                      onPress={() => handleRemoveMember(m.userId)}
                      style={styles.memberActionBtn}
                      accentColor={colors.red}
                      textStyle={{ color: '#FFFFFF' }}
                      title="KICK"
                    />
                  </View>
                )}
              </View>
            );
          })}
        </BrutalistCard>

        {/* Disconnect Leave button */}
        <BrutalistButton
          onPress={handleLeaveGroup}
          style={styles.leaveBtn}
          accentColor={colors.red}
        >
          <Text style={styles.leaveText}>LEAVE GROUP</Text>
        </BrutalistButton>

      </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  metaCard: {
    marginBottom: 8,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBezel: {
    width: 78,
    height: 78,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  groupInfoBox: {
    marginLeft: 16,
    flex: 1,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  subText: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginTop: 14,
    marginBottom: 8,
    paddingLeft: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchMeta: {
    flex: 1,
    paddingRight: 10,
  },
  switchTitle: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  switchSub: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pinText: {
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    fontWeight: 'bold',
  },
  emptySubText: {
    fontSize: 10,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  memberMeta: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  memberRole: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 4,
  },
  memberActionBtn: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  leaveBtn: {
    flexDirection: 'row',
    marginTop: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
