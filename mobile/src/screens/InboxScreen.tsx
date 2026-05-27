import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { notificationsApi } from '../api/notifications';
import type { Notification, NotifKind } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

type Filter = 'all' | 'mentions' | 'approvals' | 'status' | 'comments';

// ── Kind config ───────────────────────────────────────────────────────────────
const KIND_CFG: Record<NotifKind, { icon: string; color: string; bg: string }> = {
  mention:          { icon: 'at',                       color: '#0082c6', bg: 'rgba(0,130,198,0.16)' },
  approval_request: { icon: 'checkmark',                color: '#B06A00', bg: 'rgba(255,159,10,0.18)' },
  approved:         { icon: 'checkmark',                color: '#0A7A6E', bg: 'rgba(5,183,170,0.18)' },
  rejected:         { icon: 'flag-outline',             color: '#C0392B', bg: 'rgba(192,57,43,0.14)' },
  assigned:         { icon: 'person-outline',           color: '#6750A4', bg: 'rgba(167,139,250,0.18)' },
  comment:          { icon: 'chatbubble-outline',       color: '#0A7A6E', bg: 'rgba(5,183,170,0.16)' },
  status_changed:   { icon: 'swap-horizontal-outline',  color: '#0082c6', bg: 'rgba(0,130,198,0.14)' },
  done:             { icon: 'checkmark-done',           color: '#0A7A6E', bg: 'rgba(5,183,170,0.18)' },
  created:          { icon: 'add-circle-outline',       color: '#6E7B91', bg: 'rgba(60,60,67,0.10)' },
};

const FILTER_MAP: Record<Filter, NotifKind[] | null> = {
  all:       null,
  mentions:  ['mention'],
  approvals: ['approval_request', 'approved', 'rejected'],
  status:    ['status_changed', 'done', 'created'],
  comments:  ['comment'],
};

const AVATAR_COLORS = ['#0082c6','#05b7aa','#8b5cf6','#f59e0b','#ec4899','#6366f1','#10b981'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

function relTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM');
}

// Extract actor name from message (backend embeds it as "ActorName: preview" for comments/mentions)
function extractActor(n: Notification): string {
  if (!n.message) return '';
  const ci = n.message.indexOf(': ');
  if (ci > 0 && ci <= 30) return n.message.slice(0, ci);
  // "ActorName assigned you..."
  const words = n.message.split(' ');
  if (words.length > 1 && words[0].length > 1 && !words[0].startsWith('You')) return words[0];
  return '';
}

// Extract task name from title
function extractTask(n: Notification): string {
  const prefixes = [
    'Approval Requested: ', 'Approval requested on ',
    'New comment on ', 'New mention on ',
    'Task Approved: ', 'Task Rejected: ',
    'Task assigned: ', 'Task completed: ',
    'Status changed on ', 'New task: ',
  ];
  for (const p of prefixes) {
    if (n.title.startsWith(p)) return n.title.slice(p.length);
  }
  return n.title;
}

// ── Notification row ──────────────────────────────────────────────────────────
function NotifRow({ n, onPress, t }: { n: Notification; onPress: () => void; t: any }) {
  const cfg    = KIND_CFG[n.type] ?? { icon: 'notifications-outline', color: '#636366', bg: 'rgba(60,60,67,0.1)' };
  const unread = !n.read_at;
  const actor  = extractActor(n);
  const task   = extractTask(n);
  const isUrgent = n.type === 'approval_request' || n.type === 'rejected';

  // Message without actor prefix
  let body = n.message ?? '';
  if (actor && body.startsWith(actor + ': ')) body = body.slice(actor.length + 2);

  const initials = actor ? actor.slice(0, 2).toUpperCase() : '??';
  const avColor  = actor ? avatarColor(actor) : '#636366';

  return (
    <TouchableOpacity
      style={[
        r.row,
        { backgroundColor: t.surface },
        unread && { backgroundColor: t.primary + '07' },
        isUrgent && r.rowUrgent,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Avatar + type badge */}
      <View style={{ position: 'relative', flexShrink: 0 }}>
        <View style={[r.avatar, { backgroundColor: avColor }]}>
          <Text style={r.avatarText}>{initials}</Text>
        </View>
        <View style={[r.badge, { backgroundColor: cfg.bg, borderColor: t.surface }]}>
          <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
        </View>
        {unread && <View style={[r.unread, { backgroundColor: t.primary }]} />}
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Text style={[r.body, { color: t.ink, flex: 1 }]} numberOfLines={2}>
            {actor ? <Text style={r.actorName}>{actor} </Text> : null}
            <Text style={{ fontWeight: '400' }}>{body || n.title}</Text>
          </Text>
          <Text style={[r.time, { color: t.ink3 }]}>{relTime(n.created_at)}</Text>
        </View>
        {/* Task chip */}
        {task && task !== n.title && (
          <View style={r.taskChip}>
            <View style={[r.taskDot, { backgroundColor: cfg.color }]} />
            <Text style={[r.taskText, { color: t.ink3 }]} numberOfLines={1}>{task}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Day section header ────────────────────────────────────────────────────────
function DayHeader({ label, hi, count, t }: { label: string; hi: string; count: number; t: any }) {
  return (
    <View style={[dh.row, { borderBottomColor: t.outline }]}>
      <Text style={[dh.label, { color: t.ink3 }]}>{label}</Text>
      <Text style={[dh.hi, { color: t.ink4 }]}>{hi}</Text>
      <Text style={[dh.count, { color: t.ink3 }]}>{count}</Text>
    </View>
  );
}

// Group notifications into Today / Yesterday / Older
function groupByDay(notifs: Notification[]) {
  const today: Notification[]     = [];
  const yesterday: Notification[] = [];
  const older: Notification[]     = [];
  notifs.forEach(n => {
    const d = new Date(n.created_at);
    if (isToday(d))     today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else                older.push(n);
  });
  return { today, yesterday, older };
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function InboxScreen() {
  const { t }  = useTheme();
  const nav    = useNavigation<Nav>();
  const qc     = useQueryClient();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: notifs = [], isLoading, refetch, isFetching } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn:  notificationsApi.list,
    staleTime: 30_000,
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useCallback(async (n: Notification) => {
    if (!n.read_at) {
      try { await notificationsApi.markRead([n.notification_id]); } catch {}
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.task_id) nav.navigate('TaskDetail', { taskId: n.task_id });
  }, [nav, qc]);

  const unread = notifs.filter(n => !n.read_at).length;

  const filtered = useMemo(() => {
    const kinds = FILTER_MAP[filter];
    return kinds ? notifs.filter(n => kinds.includes(n.type)) : notifs;
  }, [notifs, filter]);

  const { today, yesterday, older } = useMemo(() => groupByDay(filtered), [filtered]);

  const CHIPS: Array<{ id: Filter; label: string; count?: number }> = [
    { id: 'all',       label: 'All',       count: notifs.length },
    { id: 'mentions',  label: 'Mentions',  count: notifs.filter(n => n.type === 'mention').length || undefined },
    { id: 'approvals', label: 'Approvals', count: notifs.filter(n => ['approval_request','approved','rejected'].includes(n.type)).length || undefined },
    { id: 'status',    label: 'Status',    count: notifs.filter(n => ['status_changed','done','created'].includes(n.type)).length || undefined },
    { id: 'comments',  label: 'Comments',  count: notifs.filter(n => n.type === 'comment').length || undefined },
  ];

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline, paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: t.primary }]}>INBOX <Text style={[s.kickerHi, { color: t.ink3 }]}>सूचना</Text></Text>
          <Text style={[s.title, { color: t.ink }]}>{unread > 0 ? `${unread} unread` : 'Inbox'}</Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            style={[s.markBtn, { borderColor: t.primary + '55', backgroundColor: t.primaryContainer + '44' }]}
          >
            {markAll.isPending
              ? <ActivityIndicator size="small" color={t.primary} />
              : <Text style={[s.markText, { color: t.primary }]}>Mark all read</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[s.chipsBar, { borderBottomColor: t.outline }]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
        {CHIPS.map(chip => {
          const active = filter === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              onPress={() => setFilter(chip.id)}
              style={[s.chip, {
                backgroundColor: active ? t.primary : t.surface,
                borderColor: active ? t.primary : t.outline,
              }]}
            >
              <Text style={[s.chipLabel, { color: active ? '#fff' : t.ink2 }]}>{chip.label}</Text>
              {chip.count != null && (
                <View style={[s.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : t.bg }]}>
                  <Text style={[s.chipBadgeText, { color: active ? '#fff' : t.ink3 }]}>{chip.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={t.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="checkmark-done-circle-outline" size={44} color={t.primary} />
          <Text style={[s.emptyTitle, { color: t.ink }]}>All caught up!</Text>
          <Text style={[s.emptyBody, { color: t.ink3 }]}>No notifications here.</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={t.primary} />}
          ListHeaderComponent={
            <>
              {today.length > 0 && (
                <>
                  <DayHeader label="Today" hi="आज" count={today.length} t={t} />
                  {today.map(n => <NotifRow key={n.notification_id} n={n} onPress={() => markOne(n)} t={t} />)}
                </>
              )}
              {yesterday.length > 0 && (
                <>
                  <DayHeader label="Yesterday" hi="कल" count={yesterday.length} t={t} />
                  {yesterday.map(n => <NotifRow key={n.notification_id} n={n} onPress={() => markOne(n)} t={t} />)}
                </>
              )}
              {older.length > 0 && (
                <>
                  <DayHeader label="Earlier" hi="पहले" count={older.length} t={t} />
                  {older.map(n => <NotifRow key={n.notification_id} n={n} onPress={() => markOne(n)} t={t} />)}
                </>
              )}
              <View style={{ height: 40 }} />
            </>
          }
          renderItem={() => null}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  kicker:       { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  kickerHi:     { fontSize: 11, fontWeight: '400', letterSpacing: 0, textTransform: 'none' },
  title:        { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  markBtn:      { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 4 },
  markText:     { fontSize: 12, fontWeight: '700' },
  chipsBar:     { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0, flexShrink: 0 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  chipLabel:    { fontSize: 13, fontWeight: '600' },
  chipBadge:    { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 99 },
  chipBadgeText:{ fontSize: 10, fontWeight: '700' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle:   { fontSize: 17, fontWeight: '800' },
  emptyBody:    { fontSize: 13, textAlign: 'center' },
});

const r = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rowUrgent:  { borderLeftWidth: 3, borderLeftColor: '#FF453A', paddingLeft: 13 },
  avatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  badge:      { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  unread:     { position: 'absolute', top: 0, left: -12, width: 6, height: 6, borderRadius: 3 },
  body:       { fontSize: 13.5, lineHeight: 19 },
  actorName:  { fontWeight: '700' },
  time:       { fontSize: 11, fontWeight: '500', marginTop: 2, flexShrink: 0 },
  taskChip:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  taskDot:    { width: 6, height: 6, borderRadius: 2, flexShrink: 0 },
  taskText:   { fontSize: 11.5, flex: 1 },
});

const dh = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  hi:    { fontSize: 11 },
  count: { marginLeft: 'auto', fontSize: 11, fontWeight: '700' },
});
