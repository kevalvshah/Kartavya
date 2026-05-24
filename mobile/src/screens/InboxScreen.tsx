import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { notificationsApi } from '../api/notifications';
import { a11yButton } from '../components/a11y';
import type { Notification, NotifKind } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

// ── Icon + colour per notification kind ──────────────────────────────────────
const KIND_META: Record<NotifKind, { icon: string; color: string }> = {
  mention:           { icon: 'at',                      color: '#0082c6' },
  approval_request:  { icon: 'shield-checkmark-outline', color: '#f59e0b' },
  approved:          { icon: 'checkmark-circle',         color: '#16a34a' },
  rejected:          { icon: 'close-circle',             color: '#ef4444' },
  assigned:          { icon: 'person-add-outline',       color: '#8b5cf6' },
  comment:           { icon: 'chatbubble-outline',       color: '#0082c6' },
  status_changed:    { icon: 'swap-horizontal-outline',  color: '#05b7aa' },
  done:              { icon: 'checkmark-done',           color: '#16a34a' },
  created:           { icon: 'add-circle-outline',       color: '#636366' },
};

function kindMeta(kind: NotifKind) {
  return KIND_META[kind] ?? { icon: 'notifications-outline', color: '#636366' };
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM');
}

// ── Row ───────────────────────────────────────────────────────────────────────
function NotifRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  const { t } = useTheme();
  const { icon, color } = kindMeta(n.type);
  const unread = !n.read_at;

  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: t.surface, borderBottomColor: t.outline }, unread && { backgroundColor: t.primary + '08' }]}
      onPress={onPress}
      activeOpacity={0.75}
      {...a11yButton(
        `${unread ? 'Unread: ' : ''}${n.title}${n.message ? '. ' + n.message : ''}. ${relativeDate(n.created_at)}`,
        n.task_id ? 'Opens task' : undefined,
      )}
    >
      {/* Left: icon badge */}
      <View style={[s.iconBadge, { backgroundColor: color + '18', borderColor: color + '44' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.rowTitle, { color: t.ink }]} numberOfLines={1}>{n.title}</Text>
          {unread && <View style={[s.unreadDot, { backgroundColor: t.primary }]} />}
        </View>
        {n.message ? <Text style={[s.rowMsg, { color: t.ink3 }]} numberOfLines={2}>{n.message}</Text> : null}
        <Text style={[s.rowTime, { color: t.ink4 }]}>{relativeDate(n.created_at)}</Text>
      </View>

      {n.task_id && <Ionicons name="chevron-forward" size={14} color={t.ink4} />}
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function InboxScreen() {
  const { t } = useTheme();
  const nav   = useNavigation<Nav>();
  const qc    = useQueryClient();

  const { data: notifs = [], isLoading, refetch, isFetching } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn:  () => notificationsApi.list(),
    staleTime: 30_000,
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications', 'count'],
    queryFn:  notificationsApi.unreadCount,
    staleTime: 30_000,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markRead(),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOne = useCallback(async (n: Notification) => {
    if (!n.read_at) {
      await notificationsApi.markRead([n.notification_id]);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.task_id) {
      nav.navigate('TaskDetail', { taskId: n.task_id });
    }
  }, [nav, qc]);

  const unread = notifs.filter(n => !n.read_at).length;

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[s.title, { color: t.ink }]}>Inbox</Text>
            <Text style={[s.titleHindi, { color: t.ink3 }]}>इनबॉक्स</Text>
          </View>
          {unread > 0 && (
            <Text style={[s.subtitle, { color: t.ink3 }]}>{unread} unread</Text>
          )}
        </View>
        {unread > 0 && (
          <TouchableOpacity
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            style={[s.markBtn, { borderColor: t.primary + '66', backgroundColor: t.primaryContainer + '55' }]}
          >
            {markAll.isPending
              ? <ActivityIndicator size="small" color={t.primary} />
              : <Text style={[s.markText, { color: t.primary }]}>Mark all read</Text>}
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={n => n.notification_id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={t.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={s.center}><ActivityIndicator color={t.primary} size="large" /></View>
          ) : (
            <View style={s.emptyWrap}>
              <View style={[s.emptyIcon, { backgroundColor: t.surface, borderColor: t.outline }]}>
                <Ionicons name="checkmark-done-circle-outline" size={40} color={t.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: t.ink }]}>All caught up!</Text>
              <Text style={[s.emptyBody, { color: t.ink3 }]}>No notifications yet.</Text>
            </View>
          )
        }
        renderItem={({ item: n }) => <NotifRow n={n} onPress={() => markOne(n)} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title:     { fontSize: 26, fontWeight: '900' },
  titleHindi:{ fontSize: 14, fontWeight: '400' },
  subtitle:  { fontSize: 12, fontWeight: '600', marginTop: 1 },
  markBtn:   { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  markText:  { fontSize: 12, fontWeight: '700' },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  iconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0, marginTop: 1 },
  rowTitle:  { fontSize: 13, fontWeight: '700', flex: 1 },
  rowMsg:    { fontSize: 12, lineHeight: 17 },
  rowTime:   { fontSize: 11, marginTop: 2 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyTitle:{ fontSize: 17, fontWeight: '800' },
  emptyBody: { fontSize: 13, lineHeight: 19 },
});
