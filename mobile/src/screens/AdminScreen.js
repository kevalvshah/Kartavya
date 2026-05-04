import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K } from '../theme';

export default function AdminScreen() {
  const [users, setUsers]     = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState('member');
  const [tab, setTab]         = useState('users');

  const load = () => {
    api.get('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    api.get('/admin/invites').then((r) => setInvites(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!email.trim()) return;
    try {
      const r = await api.post('/admin/invites', { email: email.trim(), role });
      Alert.alert('Invite created', `Share this link:\n${r.data.invite_link}`);
      setEmail(''); load();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not create invite');
    }
  };

  const roleColor = { admin: K.blue, member: K.teal, client: '#8b5cf6' };

  return (
    <View style={s.root}>
      <KHeader title="Admin" subtitle="Manage users & invites" />

      {/* Invite form */}
      <View style={s.inviteCard}>
        <Text style={s.inviteTitle}>Send Invite</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail}
          placeholder="email@company.com" placeholderTextColor={K.muted}
          autoCapitalize="none" keyboardType="email-address" />
        <View style={s.roleRow}>
          {['member', 'client'].map((r) => (
            <TouchableOpacity key={r} onPress={() => setRole(r)}
              style={[s.roleChip, role === r && { backgroundColor: roleColor[r] + '22', borderColor: roleColor[r] }]}>
              <Text style={[s.roleChipText, role === r && { color: roleColor[r] }]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={sendInvite}>
          <LinearGradient colors={K.gradD} style={s.sendBtn}>
            <Text style={s.sendBtnText}>Send Invite</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tab toggle */}
      <View style={s.tabs}>
        {['users', 'invites'].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && { color: K.blue }]}>{t === 'users' ? `Users (${users.length})` : `Pending (${invites.filter((i) => !i.accepted_at).length})`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'users' && (
        <FlatList data={users} keyExtractor={(u) => u.user_id} contentContainerStyle={s.list}
          renderItem={({ item: u }) => (
            <View style={s.userRow}>
              <LinearGradient colors={K.gradD} style={s.avatar}>
                <Text style={s.avatarText}>{(u.name || '?')[0].toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{u.name}</Text>
                <Text style={s.userEmail}>{u.email}</Text>
              </View>
              <View style={[s.rolePill, { backgroundColor: (roleColor[u.role] || K.muted) + '22' }]}>
                <Text style={[s.roleText, { color: roleColor[u.role] || K.muted }]}>{u.role}</Text>
              </View>
            </View>
          )}
        />
      )}

      {tab === 'invites' && (
        <FlatList data={invites.filter((i) => !i.accepted_at)} keyExtractor={(i) => i.invite_id}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No pending invites.</Text>}
          renderItem={({ item: inv }) => (
            <View style={s.invRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{inv.email}</Text>
                <Text style={s.userEmail}>Expires {new Date(inv.expires_at).toLocaleDateString()}</Text>
              </View>
              <View style={[s.rolePill, { backgroundColor: (roleColor[inv.role] || K.muted) + '22' }]}>
                <Text style={[s.roleText, { color: roleColor[inv.role] || K.muted }]}>{inv.role}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: K.dark },
  inviteCard:   { backgroundColor: K.card, margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,130,198,0.3)' },
  inviteTitle:  { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  input:        { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.25)', padding: 11, color: '#fff', marginBottom: 10 },
  roleRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  roleChipText: { color: K.muted, fontSize: 12, fontWeight: '700' },
  sendBtn:      { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sendBtnText:  { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  tabs:         { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  tabActive:    { backgroundColor: 'rgba(0,130,198,0.12)', borderColor: 'rgba(0,130,198,0.5)' },
  tabText:      { color: K.muted, fontSize: 12, fontWeight: '700' },
  list:         { padding: 16, paddingBottom: 40 },
  empty:        { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 20 },
  userRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: K.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  invRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: K.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  avatar:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  userName:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  userEmail:    { color: K.muted, fontSize: 11, marginTop: 2 },
  rolePill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  roleText:     { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});
