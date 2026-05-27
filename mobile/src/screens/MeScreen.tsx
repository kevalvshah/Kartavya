import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { avatarColor, userInitials } from '../theme/tokens';
import { tasksApi } from '../api/tasks';
import { notificationsApi } from '../api/notifications';
import type { RootStackParamList } from '../nav/RootStack';
import type { NotifKind, NotifPrefsResponse } from '../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

// ── Notification kind rows ────────────────────────────────────────────────────
const NOTIF_ROWS: Array<{ kind: NotifKind; label: string; hindi: string; icon: string; color: string }> = [
  { kind: 'mention',          label: 'Mentions',         hindi: 'उल्लेख',     icon: 'at',                   color: '#0082c6' },
  { kind: 'approval_request', label: 'Approval requests',hindi: 'अनुमोदन',    icon: 'checkmark-circle',     color: '#f59e0b' },
  { kind: 'assigned',         label: 'Assigned to me',   hindi: 'असाइन किया', icon: 'person-add',           color: '#05b7aa' },
  { kind: 'comment',          label: 'Comments',         hindi: 'टिप्पणियाँ', icon: 'chatbubble-ellipses',  color: '#8b5cf6' },
  { kind: 'status_changed',   label: 'Status changes',   hindi: 'स्थिति',     icon: 'swap-horizontal',      color: '#64748b' },
  { kind: 'done',             label: 'Task completed',   hindi: 'पूर्ण',      icon: 'checkmark-done',       color: '#22c55e' },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MeScreen() {
  const { t, scheme }  = useTheme();
  const { user, logout } = useAuth();
  const nav            = useNavigation<Nav>();
  const insets         = useSafeAreaInsets();
  const qc             = useQueryClient();

  // Tasks stats
  const { data: myTasks = [] } = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn:  () => tasksApi.list(),
    staleTime: 60_000,
  });

  const myId = user?.user_id ?? '';
  const isMine = (task: typeof myTasks[number]) =>
    task.created_by_user_id === myId || (task.assignee_user_ids ?? []).includes(myId);

  const stats = useMemo(() => ({
    open:    myTasks.filter(t => t.status !== 'done' && isMine(t)).length,
    done:    myTasks.filter(t => t.status === 'done' && isMine(t)).length,
    overdue: myTasks.filter(t =>
      t.status !== 'done' && !!t.due_at && isMine(t) && new Date(t.due_at) < new Date()
    ).length,
  }), [myTasks, myId]);

  // Notif prefs
  const { data: prefs, isLoading: prefsLoading } = useQuery<NotifPrefsResponse>({
    queryKey: ['notif-prefs'],
    queryFn:  notificationsApi.getPrefs,
    staleTime: 30_000,
  });

  const { mutate: savePrefs } = useMutation({
    mutationFn: (body: NotifPrefsResponse) => notificationsApi.setPrefs(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notif-prefs'] }),
  });

  function toggleKind(kind: NotifKind, on: boolean) {
    if (!prefs) return;
    const kinds = on
      ? [...(prefs.kinds ?? []), kind]
      : (prefs.kinds ?? []).filter(k => k !== kind);
    savePrefs({ ...prefs, kinds });
  }

  const initials = user ? userInitials(user.name ?? user.full_name ?? '?') : '?';
  const bgColor  = user ? avatarColor(user.user_id) : '#0082c6';
  const displayName = user?.name ?? user?.full_name ?? '—';

  return (
    <ScrollView
      style={[s.root, { backgroundColor: t.bg }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero gradient ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0082c6', '#03a1b6', '#05b7aa']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 16 }]}
      >
        <Text style={s.kicker}>SETTINGS · विकल्प</Text>
        <Text style={s.heroTitle}>You &amp; your app</Text>

        {/* Profile row */}
        <View style={s.profileRow}>
          <View style={[s.avatar, { backgroundColor: bgColor }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{displayName}</Text>
            <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
          </View>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{user?.role ?? 'member'}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatPill label="Open"    hindi="खुले"    value={stats.open}    color="#fff" />
          <View style={s.statsDivider} />
          <StatPill label="Done"    hindi="पूर्ण"   value={stats.done}    color="#a7f3d0" />
          <View style={s.statsDivider} />
          <StatPill label="Overdue" hindi="विलंबित" value={stats.overdue} color={stats.overdue > 0 ? '#fca5a5' : 'rgba(255,255,255,0.6)'} />
        </View>
      </LinearGradient>

      {/* ── Notification toggles ───────────────────────────────────────────── */}
      <Text style={[s.sectionLabel, { color: t.ink3 }]}>NOTIFICATIONS · सूचनाएं</Text>
      <View style={[s.card, { backgroundColor: t.surface, borderColor: t.outline }]}>
        {prefsLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={t.primary} size="small" />
          </View>
        ) : (
          NOTIF_ROWS.map((row, i) => {
            const enabled = (prefs?.kinds ?? []).includes(row.kind);
            return (
              <View
                key={row.kind}
                style={[s.notifRow, i < NOTIF_ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.outline }]}
              >
                <View style={[s.notifIconWrap, { backgroundColor: row.color + '18' }]}>
                  <Ionicons name={row.icon as any} size={15} color={row.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.notifLabel, { color: t.ink }]}>{row.label}</Text>
                  <Text style={[s.notifHindi, { color: t.ink4 }]}>{row.hindi}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={v => toggleKind(row.kind, v)}
                  trackColor={{ false: t.outline, true: t.primary + 'aa' }}
                  thumbColor={enabled ? t.primary : (Platform.OS === 'android' ? t.ink4 : undefined)}
                  ios_backgroundColor={t.outline}
                />
              </View>
            );
          })
        )}
      </View>

      {/* ── App settings ──────────────────────────────────────────────────── */}
      <Text style={[s.sectionLabel, { color: t.ink3 }]}>APP SETTINGS · ऐप</Text>
      <View style={[s.card, { backgroundColor: t.surface, borderColor: t.outline }]}>
        <TouchableOpacity
          style={[s.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.outline }]}
          onPress={() => nav.navigate('Settings')}
          activeOpacity={0.7}
        >
          <View style={[s.menuIconWrap, { backgroundColor: t.primaryContainer }]}>
            <Ionicons name="settings-outline" size={15} color={t.primary} />
          </View>
          <Text style={[s.menuLabel, { color: t.ink }]}>All settings</Text>
          <Text style={[s.menuSub, { color: t.ink3 }]}>सभी सेटिंग्स</Text>
          <Ionicons name="chevron-forward" size={14} color={t.ink4} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.menuRow}
          onPress={logout}
          activeOpacity={0.7}
        >
          <View style={[s.menuIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Ionicons name="log-out-outline" size={15} color="#ef4444" />
          </View>
          <Text style={[s.menuLabel, { color: '#ef4444' }]}>Sign out</Text>
          <Text style={[s.menuSub, { color: 'rgba(239,68,68,0.6)' }]}>साइन आउट</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatPill({ label, hindi, value, color }: { label: string; hindi: string; value: number; color: string }) {
  return (
    <View style={s.statPill}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statHindi}>{hindi}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  hero:         { paddingHorizontal: 20, paddingBottom: 24 },
  kicker:       { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle:    { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 20 },
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { color: '#fff', fontSize: 18, fontWeight: '900' },
  profileName:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  profileEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  roleBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  roleText:     { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },

  // Stats
  statsRow:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 14, gap: 0 },
  statPill:     { flex: 1, alignItems: 'center', gap: 2 },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },
  statValue:    { fontSize: 22, fontWeight: '900' },
  statLabel:    { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statHindi:    { color: 'rgba(255,255,255,0.5)', fontSize: 9 },

  // Sections
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, color: '#636366' },
  card:         { marginHorizontal: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  // Notif rows
  notifRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  notifIconWrap:{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifLabel:   { fontSize: 13, fontWeight: '600' },
  notifHindi:   { fontSize: 10, marginTop: 1 },

  // Menu rows
  menuRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuLabel:    { flex: 1, fontSize: 14, fontWeight: '600' },
  menuSub:      { fontSize: 11, marginRight: 4 },
});
