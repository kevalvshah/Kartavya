import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, SectionList, ScrollView,
  TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { isToday, isTomorrow, isThisWeek, isPast } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { tasksApi } from '../api/tasks';
import { TaskCard } from '../components/TaskCard';
import { a11yHeading } from '../components/a11y';
import type { Task } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

// ── Filter chips ─────────────────────────────────────────────────────────────
type Filter = 'all' | 'today' | 'overdue';
const FILTER_CHIPS: Array<{ id: Filter; label: string; hindi: string }> = [
  { id: 'all',     label: 'All',       hindi: 'सभी' },
  { id: 'today',   label: 'Due today', hindi: 'आज' },
  { id: 'overdue', label: 'Overdue',   hindi: 'विलंबित' },
];

// ── Section buckets ───────────────────────────────────────────────────────────
interface Section { title: string; titleHindi: string; accent: string; data: Task[] }

function bucketTasks(tasks: Task[], userId: string): Section[] {
  const mine = tasks.filter(t =>
    t.created_by_user_id === userId ||
    (Array.isArray(t.assignee_user_ids) && t.assignee_user_ids.includes(userId))
  );

  const overdue:   Task[] = [];
  const dueToday:  Task[] = [];
  const tomorrow:  Task[] = [];
  const thisWeek:  Task[] = [];
  const noDate:    Task[] = [];

  mine.forEach(t => {
    if (t.status === 'done' || t.status === 'complete') return;
    if (!t.due_at) { noDate.push(t); return; }
    const d = new Date(t.due_at);
    if (isPast(d) && !isToday(d))      overdue.push(t);
    else if (isToday(d))               dueToday.push(t);
    else if (isTomorrow(d))            tomorrow.push(t);
    else if (isThisWeek(d, { weekStartsOn: 1 })) thisWeek.push(t);
    else                               noDate.push(t);
  });

  const sections: Section[] = [];
  if (overdue.length)  sections.push({ title: 'Overdue',     titleHindi: 'विलंबित',   accent: '#ef4444', data: overdue });
  if (dueToday.length) sections.push({ title: 'Due Today',   titleHindi: 'आज',         accent: '#f59e0b', data: dueToday });
  if (tomorrow.length) sections.push({ title: 'Tomorrow',    titleHindi: 'कल',         accent: '#0082c6', data: tomorrow });
  if (thisWeek.length) sections.push({ title: 'This Week',   titleHindi: 'इस सप्ताह', accent: '#05b7aa', data: thisWeek });
  if (noDate.length)   sections.push({ title: 'No Due Date', titleHindi: 'कोई तारीख नहीं', accent: '#636366', data: noDate });
  return sections;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const { t }   = useTheme();
  const { user } = useAuth();
  const nav      = useNavigation<Nav>();
  const [activeFilter, setActiveFilter] = useState<Filter>('all');

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn:  () => tasksApi.list(),
    staleTime: 60_000,
  });

  const allSections = useMemo(
    () => user ? bucketTasks(tasks, user.user_id) : [],
    [tasks, user]
  );

  const sections = useMemo(() => {
    if (activeFilter === 'today')   return allSections.filter(s => s.title === 'Due Today');
    if (activeFilter === 'overdue') return allSections.filter(s => s.title === 'Overdue');
    return allSections;
  }, [allSections, activeFilter]);

  const totalMine    = allSections.reduce((n, s) => n + s.data.length, 0);
  const overdueCount = allSections.find(s => s.title === 'Overdue')?.data.length ?? 0;
  const todayCount   = allSections.find(s => s.title === 'Due Today')?.data.length ?? 0;

  const openTask = useCallback((taskId: string) => {
    nav.navigate('TaskDetail', { taskId });
  }, [nav]);

  const now = new Date();
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.toDateString()]);

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.task_id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, sections.length === 0 && s.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={t.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* ── Top header ── */}
            <LinearGradient
              colors={['#0082c6', '#03a1b6', '#05b7aa']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.hero}
              accessible
              accessibilityLabel={`${greeting}, ${user?.name?.split(' ')[0] ?? 'there'}. ${totalMine} open tasks${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}${todayCount > 0 ? `, ${todayCount} due today` : ''}.`}
            >
              <Text style={s.heroGreet} accessibilityElementsHidden>{greeting},</Text>
              <Text style={s.heroName} accessibilityElementsHidden>{user?.name?.split(' ')[0] ?? 'there'}</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}>
                  <Text style={s.heroStatNum}>{totalMine}</Text>
                  <Text style={s.heroStatLabel}>open tasks</Text>
                </View>
                {overdueCount > 0 && (
                  <View style={[s.heroStat, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)', paddingLeft: 16 }]}>
                    <Text style={[s.heroStatNum, { color: '#fca5a5' }]}>{overdueCount}</Text>
                    <Text style={s.heroStatLabel}>overdue</Text>
                  </View>
                )}
                {todayCount > 0 && (
                  <View style={[s.heroStat, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)', paddingLeft: 16 }]}>
                    <Text style={s.heroStatNum}>{todayCount}</Text>
                    <Text style={s.heroStatLabel}>due today</Text>
                  </View>
                )}
              </View>
            </LinearGradient>

            {/* ── Filter chips ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
            >
              {FILTER_CHIPS.map(chip => {
                const active = activeFilter === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => setActiveFilter(chip.id)}
                    style={[
                      s.chip,
                      {
                        backgroundColor: active ? t.primary : t.surface,
                        borderColor:     active ? t.primary : t.outline,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${chip.label} ${chip.hindi}`}
                  >
                    <Text style={[s.chipLabel, { color: active ? '#fff' : t.ink2 }]}>
                      {chip.label}
                    </Text>
                    <Text style={[s.chipHindi, { color: active ? 'rgba(255,255,255,0.75)' : t.ink4 }]}>
                      {chip.hindi}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {isLoading && (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={t.primary} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.emptyWrap}>
              <View style={[s.emptyIcon, { backgroundColor: t.surface, borderColor: t.outline }]}>
                <Ionicons name="checkmark-done" size={32} color={t.primary} />
              </View>
              <Text style={[s.emptyTitle, { color: t.ink }]}>You're all caught up!</Text>
              <Text style={[s.emptyBody, { color: t.ink3 }]}>No tasks assigned to you this week.</Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHead} {...a11yHeading(`${section.title}, ${section.data.length} task${section.data.length === 1 ? '' : 's'}`)}>
            <View style={[s.sectionDot, { backgroundColor: section.accent }]} accessibilityElementsHidden />
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: t.ink2 }]}>{section.title}</Text>
              <Text style={[s.sectionHindi, { color: t.ink4 }]}>{section.titleHindi}</Text>
            </View>
            <View style={[s.sectionBadge, { backgroundColor: section.accent + '22' }]}>
              <Text style={[s.sectionBadgeText, { color: section.accent }]}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <TaskCard task={item} onPress={() => openTask(item.task_id)} />
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1 },
  list:            { paddingBottom: 32 },
  listEmpty:       { flexGrow: 1 },
  // Hero
  hero:            { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 28, paddingHorizontal: 22 },
  heroGreet:       { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  heroName:        { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 2, marginBottom: 18 },
  heroStats:       { flexDirection: 'row', gap: 16 },
  heroStat:        { gap: 2 },
  heroStatNum:     { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroStatLabel:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  // Sections
  sectionHead:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 8 },
  sectionDot:      { width: 7, height: 7, borderRadius: 4 },
  sectionTitle:    { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionHindi:    { fontSize: 10, marginTop: 1 },
  // Filter chips
  chipsRow:        { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  chipLabel:       { fontSize: 12, fontWeight: '700' },
  chipHindi:       { fontSize: 10, fontWeight: '400' },
  sectionBadge:    { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText:{ fontSize: 11, fontWeight: '800' },
  // Card wrapper (adds horizontal margin around shared TaskCard)
  cardWrap:        { paddingHorizontal: 16 },
  // Empty
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 14 },
  emptyIcon:       { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyTitle:      { fontSize: 18, fontWeight: '800' },
  emptyBody:       { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
