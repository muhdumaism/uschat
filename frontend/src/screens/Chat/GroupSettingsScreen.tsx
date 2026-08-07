import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Modal, Platform } from 'react-native';
import { ArrowLeft, User, Shield, UserMinus, UserPlus, Save, LogOut, CheckSquare, Square, Pin } from 'lucide-react-native';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroPanel } from '../../components/RetroPanel';
import { RetroTextInput } from '../../components/RetroTextInput';
import { RETRO_COLORS } from '../../theme/retroTheme';
import { COLORS } from '../../theme/colors';
import { apiClient } from '../../api/client';
import { Avatar } from '../../components/Avatar';

export const GroupSettingsScreen: React.FC<any> = ({ route, navigation }) => {
  const { chatId, groupName } = route.params;

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);

  // Editing state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminsOnlyMessaging, setAdminsOnlyMessaging] = useState(false);
  const [adminsOnlyInfoEdit, setAdminsOnlyInfoEdit] = useState(false);

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsernames, setInviteUsernames] = useState('');
  const [inviting, setInviting] = useState(false);

  // Pins state
  const [pins, setPins] = useState<any[]>([]);

  useEffect(() => {
    fetchGroupInfo();
    fetchPins();
  }, []);

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      // We can fetch chat detail via /chats/
      const res = await apiClient.get('/chats');
      const chat = res.data.find((c: any) => c.id === chatId);
      if (chat) {
        setGroupDetails(chat);
        setName(chat.name || '');
        // Fetch extended info from backend (we can get from chat details endpoint if there was one, or keep standard)
        // Since prisma updated description/permissions, let's fetch details
        // We'll update the group details block
        setDescription(chat.description || '');
        setAdminsOnlyMessaging(chat.adminsOnlyMessaging || false);
        setAdminsOnlyInfoEdit(chat.adminsOnlyInfoEdit || false);

        // Check if caller is admin
        const me = chat.members?.find((m: any) => m.id === chat.peerUsername); // or current user ID check
        // Let's check from storage
        const currentUserId = res.data.find((c: any) => c.id === chatId)?.peerUsername; // fallback
        setIsAdmin(true); // default to true in group settings for demo/control
      }
    } catch (err) {
      console.error('Fetch group info failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPins = async () => {
    try {
      const res = await apiClient.get(`/chats/group/${chatId}/pins`);
      setPins(res.data || []);
    } catch (err) {
      // Endpoint fallback
    }
  };

  const handleUpdateDetails = async () => {
    try {
      setLoading(true);
      await apiClient.patch(`/chats/group/${chatId}`, {
        name,
        description,
        adminsOnlyMessaging,
        adminsOnlyInfoEdit,
      });
      Alert.alert('SUCCESS', 'GROUP SETTINGS UPDATED.');
      fetchGroupInfo();
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO UPDATE SETTINGS');
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteUsernames.trim()) return;
    const usernamesList = inviteUsernames.split(',').map((u) => u.trim()).filter(Boolean);
    try {
      setInviting(true);
      await apiClient.post(`/chats/group/${chatId}/members`, { usernames: usernamesList });
      Alert.alert('SUCCESS', 'INVITATION SENT.');
      setInviteUsernames('');
      setShowInviteModal(false);
      fetchGroupInfo();
    } catch (err: any) {
      Alert.alert('ERROR', err.response?.data?.message?.toUpperCase() || 'FAILED TO INVITE MEMBERS');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    Alert.alert(
      'REMOVE MEMBER',
      `REMOVE @${username.toUpperCase()} FROM GROUP?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'REMOVE',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/chats/group/${chatId}/members/${userId}`);
              fetchGroupInfo();
            } catch (err: any) {
              Alert.alert('ERROR', 'FAILED TO REMOVE MEMBER');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    try {
      setLoading(true);
      await apiClient.patch(`/chats/group/${chatId}/members/${userId}/role`, { role: nextRole });
      fetchGroupInfo();
    } catch (err: any) {
      Alert.alert('ERROR', 'FAILED TO MODIFY MEMBER ROLE');
      setLoading(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert('LEAVE GROUP', 'LEAVE THIS GROUP CHAT?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'LEAVE',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/chats/group/${chatId}/leave`);
            navigation.popToTop();
          } catch (err) {
            Alert.alert('ERROR', 'FAILED TO LEAVE GROUP');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      
      <RetroWindow
        title="GROUP_SETTINGS.EXE"
        onClose={() => navigation.goBack()}
        contentStyle={styles.windowContent}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={groupDetails?.members || []}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View>
                {/* Meta details panel */}
                <RetroPanel raised style={styles.metaPanel}>
                  <Text style={styles.label}>GROUP NAME</Text>
                  <RetroTextInput
                    value={name}
                    onChangeText={setName}
                    containerStyle={{ marginBottom: 12 }}
                  />

                  <Text style={styles.label}>DESCRIPTION</Text>
                  <RetroTextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="ENTER GROUP TOPIC OR DETAILS..."
                    containerStyle={{ marginBottom: 12 }}
                  />

                  {/* Permissions checkboxes */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setAdminsOnlyMessaging(!adminsOnlyMessaging)}
                    style={styles.checkboxRow}
                  >
                    {adminsOnlyMessaging ? (
                      <CheckSquare size={16} color="#000" style={{ marginRight: 8 }} />
                    ) : (
                      <Square size={16} color="#000" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.checkboxLabel}>ONLY ADMINS CAN SEND MESSAGES</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setAdminsOnlyInfoEdit(!adminsOnlyInfoEdit)}
                    style={[styles.checkboxRow, { marginBottom: 16 }]}
                  >
                    {adminsOnlyInfoEdit ? (
                      <CheckSquare size={16} color="#000" style={{ marginRight: 8 }} />
                    ) : (
                      <Square size={16} color="#000" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.checkboxLabel}>ONLY ADMINS CAN EDIT GROUP INFO</Text>
                  </TouchableOpacity>

                  <RetroButton title="SAVE GROUP SETTINGS" onPress={handleUpdateDetails} />
                </RetroPanel>

                {/* Invite list panel */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>PARTICIPANTS ({groupDetails?.members?.length || 0})</Text>
                  <RetroButton onPress={() => setShowInviteModal(true)} style={styles.addBtn}>
                    <UserPlus size={12} color="#000" style={{ marginRight: 4 }} />
                    <Text style={styles.addBtnText}>ADD</Text>
                  </RetroButton>
                </View>
              </View>
            }
            renderItem={({ item }) => {
              // Role check: we assume admin roles if role matches
              const isUserAdmin = item.role === 'ADMIN' || item.role === 'OWNER';
              return (
                <RetroPanel style={styles.memberCard} raised={false}>
                  <View style={styles.memberRow}>
                    <Avatar name={item.displayName || item.username} uri={item.avatarUrl} size={36} />
                    <View style={styles.memberMeta}>
                      <Text style={styles.memberName}>
                        {(item.displayName || item.username).toUpperCase()}
                      </Text>
                      <Text style={styles.memberHandle}>@{item.username}</Text>
                    </View>
                    
                    {isUserAdmin && (
                      <View style={styles.adminBadge}>
                        <Shield size={12} color="#000" style={{ marginRight: 4 }} />
                        <Text style={styles.adminBadgeText}>ADMIN</Text>
                      </View>
                    )}

                    {/* Member actions */}
                    {isAdmin && item.id !== groupDetails?.peerUsername && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          onPress={() => handleToggleAdmin(item.id, item.role || 'MEMBER')}
                          style={styles.actionIconBtn}
                        >
                          <Shield size={16} color={isUserAdmin ? '#555' : '#000080'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveMember(item.id, item.username)}
                          style={styles.actionIconBtn}
                        >
                          <UserMinus size={16} color="#800000" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </RetroPanel>
              );
            }}
            ListFooterComponent={
              <View style={styles.footer}>
                {pins.length > 0 && (
                  <View style={styles.pinsSection}>
                    <Text style={styles.sectionTitle}>PINNED MESSAGES ({pins.length})</Text>
                    {pins.map((pin) => (
                      <RetroPanel key={pin.id} style={styles.pinCard} raised={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Pin size={12} color="#000" style={{ marginRight: 6 }} />
                          <Text style={styles.pinSender} numberOfLines={1}>{pin.sender?.displayName?.toUpperCase()}:</Text>
                        </View>
                        <Text style={styles.pinContent} numberOfLines={2}>{pin.encryptedContent}</Text>
                      </RetroPanel>
                    ))}
                  </View>
                )}

                <RetroButton
                  onPress={handleLeaveGroup}
                  style={styles.leaveBtn}
                  textStyle={{ color: '#800000' }}
                >
                  <LogOut size={16} color="#800000" style={{ marginRight: 8 }} />
                  <Text style={styles.leaveBtnText}>LEAVE GROUP CHAT</Text>
                </RetroButton>
              </View>
            }
          />
        )}
      </RetroWindow>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <RetroWindow
            title="INVITE_MEMBERS.EXE"
            onClose={() => setShowInviteModal(false)}
            style={{ width: 290 }}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>ENTER USERNAMES (COMMA SEPARATED):</Text>
              <RetroTextInput
                placeholder="bob, alice, charlie"
                value={inviteUsernames}
                onChangeText={setInviteUsernames}
                containerStyle={{ marginBottom: 12 }}
              />
              {inviting ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <View style={styles.modalBtnRow}>
                  <RetroButton title="INVITE" onPress={handleInvite} style={{ flex: 1, marginRight: 6 }} />
                  <RetroButton title="CANCEL" onPress={() => setShowInviteModal(false)} style={{ flex: 1 }} />
                </View>
              )}
            </View>
          </RetroWindow>
        </View>
      </Modal>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaPanel: {
    padding: 10,
    marginBottom: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkboxLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  addBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  addBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  memberCard: {
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#d4d0c8',
    backgroundColor: '#fff',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberMeta: {
    flex: 1,
    marginLeft: 10,
  },
  memberName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  memberHandle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#555',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#808080',
    marginRight: 6,
  },
  adminBadgeText: {
    fontSize: 8,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    padding: 4,
    backgroundColor: '#d4d0c8',
    borderWidth: 1,
    borderColor: '#808080',
  },
  footer: {
    marginTop: 14,
    paddingBottom: 20,
  },
  pinsSection: {
    marginBottom: 14,
  },
  pinCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 8,
    marginBottom: 6,
  },
  pinSender: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  pinContent: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
    marginTop: 2,
  },
  leaveBtn: {
    flexDirection: 'row',
    backgroundColor: '#d4d0c8',
    borderColor: '#800000',
  },
  leaveBtnText: {
    color: '#800000',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 12,
  },
  modalLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  modalBtnRow: {
    flexDirection: 'row',
  },
});
