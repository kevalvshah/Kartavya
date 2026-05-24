/**
 * MeScreen — profile overview tab.
 * Full settings are in SettingsScreen (push-navigated from here).
 */
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { avatarColor, userInitials } from '../theme/tokens';
import { tasksApi } from '../api/tasks';
import type { RootStackParamList } from '../nav/RootStack';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

export default function MeScreen() {
  const { t }        = useTheme();
  const { user }     = useAuth();
  const nav          = useNavigation<Nav>();

  const { data: myTasks = [] } = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn:  () => tasksApi.list(),
    staleTime: 60_000,
  });

  const done    = myTasks.filter(t => t.status === 'done' && (
    t.created_by_user_id === user?.user_id || (t.assignee_user_ids ?? []).includes(user?.user_id ?? '')
  )).length;
  const open    = myTasks.filter(t => t.status !== 'done' && (
    t.user_id === user?.user_id || (t.assignee_user_ids ?? []).includes(user?.user_id ?? '')
  )).length;
  const overdue = myTasks.filter(t => {
    if (t.status === 'done' || !t.due_at) return false;
    if (!(t.user_id === user?.user_id || (t.assignee_user_ids ?? []).includes(user?.user_id ?? ''))) return false;
    return new Date(t.due_at) < new Date();
  }).length;

  const initials = user ? userInitials(user.name ?? user.full_name ?? '?') : '?';
  const bgColor  = user ? avatarColor(user.user_id) : '#0082c6';

  const menuItems: Array<{ icon: string; label: string; onPress: () => void; danger?: boolean }> = [
    { icon: 'settings-outline',        label: 'Settings & Notifications', onPress: () => (nav as any).navigate('Settings') },
    { icon: 'notifications-outline',   label: 'Notification preferences', onPress: () => (nav as any).navigate('Settings') },
  ];

  return (
    <ScrollView style={[s.root, { backgroundColor: t.bg }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
        <Text style={[s.title, { color: t.ink }]}>Me</Text>
        <TouchableOpacity onPress={() => (nav as any).navigate('Settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={22} color={t.ink3} />
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View style={[s.profileCard, { backgroundColor: t.surface, borderColor: t.outline }]}>
        <View style={[s.avatar, { backgroundColor: bgColor }]}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: t.ink }]}>{user?.name ?? user?.full_name ?? '—'}</Text>
          <Text style={[s.email, { color: t.ink3 }]}>{user?.email ?? ''}</Text>
          {user?.position ? <Text style={[s.job, { color: t.ink3 }]}>{user.position}</Text> : null}
        </View>
        <View style={[s.roleBadge, { backgroundColor: t.primaryContainer }]}>
          <Text style={[s.roleText, { color: t.primary }]}>{user?.role}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <StatCard label="Open" value={open}    color={t.primary} t={t} />
        <StatCard label="Done" value={done}    color="#22c55e"  t={t} />
        <StatCard label="Overdue" value={overdue} color="#ef4444"  t={t} />
      </View>

      {/* Quick links */}
      <Text style={[s.sectionLabel, { color: t.ink3 }]}>QUICK LINKS</Text>
      <View style={[s.section, { backgroundColor: t.surface, borderColor: t.outline }]}>
        <TouchableOpacity
          style={[s.menuRow, { borderBottomColor: t.outline }]}
          onPress={() => (nav as any).navigate('Settings')}
        >
          <View style={[s.menuIcon, { backgroundColor: t.primaryContainer }]}>
            <Ionicons name="settings-outline" size={16} color={t.primary} />
          </View>
          <Text style={[s.menuLabel, { color: t.ink }]}>Settings & Notifications</Text>
          <Ionicons name="chevron-forward" size={14} color={t.ink3} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color, t }: { label: string; value: number; color: string; t: any }) {
  return (
    <View style={[s.statCard, { backgroundColor: t.surface, borderColor: t.outline }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={[s.statLabel, { color: t.ink3 }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title:        { fontSize: 26, fontWeight: '900' },
  profileCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  avatar:       { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { color: '#fff', fontSize: 17, fontWeight: '900' },
  name:         { fontSize: 15, fontWeight: '800' },
  email:        { fontSize: 11, marginTop: 2 },
  job:          { fontSize: 11, marginTop: 1 },
  roleBadge:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  roleText:     { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  statsRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 6 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, gap: 2 },
  statValue:    { fontSize: 26, fontWeight: '900' },
  statLabel:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  section:      { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  menuRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  menuIcon:     { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuLabel:    { flex: 1, fontSize: 14, fontWeight: '600' },
});
