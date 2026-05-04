import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiLogout, getUser } from '../api';
import { K } from '../theme';

export default function ProfileScreen({ onLogout }) {
  const [user, setUser] = useState(null);
  useEffect(() => { getUser().then(setUser); }, []);

  const confirmLogout = () => Alert.alert('Sign out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await apiLogout(); onLogout?.(); } },
  ]);

  const roleColor = { admin: K.blue, member: K.teal, client: K.purple };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.brand}>KARTAVYA</Text>
        <Text style={s.brandSub}>by Aekam Inc</Text>
      </View>
      <View style={s.content}>
        <LinearGradient colors={K.gradD} style={s.avatar}>
          <Text style={s.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={[s.roleBadge, { backgroundColor: (roleColor[user?.role] || K.muted) + '22', borderColor: (roleColor[user?.role] || K.muted) + '55' }]}>
          <Text style={[s.roleText, { color: roleColor[user?.role] || K.muted }]}>{(user?.role || 'member').toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={confirmLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.footer}>Kartavya · by Aekam Inc · v1.0.0</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: K.dark },
  header:    { backgroundColor: K.card, paddingTop: 52, paddingBottom: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,130,198,0.2)' },
  brand:     { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 4 },
  brandSub:  { color: K.teal, fontSize: 9, fontWeight: '700', letterSpacing: 3, marginTop: 2 },
  content:   { flex: 1, alignItems: 'center', padding: 32 },
  avatar:    { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 16 },
  avatarText:{ color: '#fff', fontSize: 36, fontWeight: '900' },
  name:      { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  email:     { color: K.muted, fontSize: 14, marginBottom: 16 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99, borderWidth: 1, marginBottom: 40 },
  roleText:  { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  logoutBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  logoutText:{ color: K.danger, fontSize: 14, fontWeight: '800' },
  footer:    { color: 'rgba(255,255,255,0.2)', fontSize: 10, letterSpacing: 2, textAlign: 'center', paddingBottom: 24 },
});
