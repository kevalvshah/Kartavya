import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Modal, TextInput, ActivityIndicator,
  Platform, Alert, RefreshControl, KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isPast } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { tasksApi } from '../api/tasks';
import { projectsApi } from '../api/projects';
import { PRIORITY_COLOR, projectColor } from '../theme/tokens';
import type { Task, ProjectColumn, TeamMember } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Route = RouteProp<RootStackParamList, 'Board'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'Board'>;

const VIEWS = ['Board', 'List', 'Schedule', 'Tracker'] as const;
type ViewMode = typeof VIEWS[number];

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

// ── Task card (Board view) ────────────────────────────────────────────────────
function BoardCard({ task, col, onPress }: { task: Task; col?: ProjectColumn; onPress: () => void }) {
  const { t } = useTheme();
  const pri   = PRIORITY_COLOR[task.priority] ?? '#636366';
  const done  = (task.subtasks ?? []).filter(s => s.is_done).length;
  const total = (task.subtasks ?? []).length;
  const isLate = task.due_at ? isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at)) : false;

  return (
    <TouchableOpacity
      style={[s.bCard, { backgroundColor: t.surface, borderColor: t.outline }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={s.bCardTop}>
        <Text style={[s.bCardTitle, { color: t.ink }]} numberOfLines={2}>{task.title}</Text>
        <View style={[s.priDot, { backgroundColor: pri }]} />
      </View>
      {task.description ? (
        <Text style={[s.bCardDesc, { color: t.ink3 }]} numberOfLines={2}>{task.description}</Text>
      ) : null}
      {task.due_at ? (
        <View style={s.bCardMeta}>
          <Ionicons name="calendar-outline" size={10} color={isLate ? '#ef4444' : t.ink3} />
          <Text style={[s.bCardMetaText, { color: isLate ? '#ef4444' : t.ink3 }]}>
            {format(new Date(task.due_at), 'd MMM')}
          </Text>
        </View>
      ) : null}
      {total > 0 && (
        <View style={s.progressRow}>
          <View style={[s.progressTrack, { backgroundColor: t.outline }]}>
            <View style={[s.progressBar, { width: `${(done / total) * 100}%`, backgroundColor: col?.color ?? '#0082c6' }]} />
          </View>
          <Text style={[s.progressText, { color: t.ink3 }]}>{done}/{total}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── New task modal ────────────────────────────────────────────────────────────
function NewTaskModal({
  visible, columns, members, projectId,
  onClose, onCreated,
}: {
  visible: boolean;
  columns: ProjectColumn[];
  members: TeamMember[];
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTheme();
  const [title,     setTitle]     = useState('');
  const [colId,     setColId]     = useState(columns[0]?.column_id ?? '');
  const [priority,  setPriority]  = useState<typeof PRIORITIES[number]>('medium');
  const [dueDate,   setDueDate]   = useState('');
  const [saving,    setSaving]    = useState(false);

  const reset = () => { setTitle(''); setColId(columns[0]?.column_id ?? ''); setPriority('medium'); setDueDate(''); };

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        column_id: colId || columns[0]?.column_id,
        team_id:   projectId,
        priority,
        due_at:    dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: t.surface, borderColor: t.outline }]}>
          <View style={s.sheetHandle} />
          <Text style={[s.sheetTitle, { color: t.ink }]}>New Task</Text>

          {/* Title */}
          <TextInput
            style={[s.sheetInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor={t.ink3}
            autoFocus
            returnKeyType="done"
          />

          {/* Column */}
          <Text style={[s.sheetLabel, { color: t.ink3 }]}>COLUMN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {columns.map(c => (
              <TouchableOpacity
                key={c.column_id}
                onPress={() => setColId(c.column_id)}
                style={[s.colChip, { backgroundColor: colId === c.column_id ? c.color : t.bg, borderColor: c.color }]}
              >
                <Text style={{ color: colId === c.column_id ? '#fff' : c.color, fontSize: 12, fontWeight: '700' }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Priority */}
          <Text style={[s.sheetLabel, { color: t.ink3 }]}>PRIORITY</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {PRIORITIES.map(p => {
              const pc = PRIORITY_COLOR[p];
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[s.priChip, { backgroundColor: active ? pc : pc + '22', borderColor: pc }]}
                >
                  <Text style={{ color: active ? '#fff' : pc, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Buttons */}
          <View style={s.sheetBtns}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={[s.cancelBtn, { borderColor: t.outline }]}>
              <Text style={[s.cancelText, { color: t.ink3 }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={create} disabled={!title.trim() || saving} style={{ flex: 1 }}>
              <LinearGradient
                colors={['#0082c6', '#03a1b6', '#05b7aa']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.createBtn, (!title.trim() || saving) && { opacity: 0.5 }]}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.createText}>Create Task</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BoardScreen() {
  const { t }  = useTheme();
  const route  = useRoute<Route>();
  const nav    = useNavigation<Nav>();
  const qc     = useQueryClient();
  const { projectId, projectName } = route.params;

  const [view,      setView]      = useState<ViewMode>('Board');
  const [adding,    setAdding]    = useState(false);

  const colColor = projectColor(projectId);

  const { data: columns = [], isLoading: colsLoading } = useQuery({
    queryKey: ['columns', projectId],
    queryFn:  () => projectsApi.columns(projectId),
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn:  () => tasksApi.list({ team_id: projectId }),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', projectId],
    queryFn:  () => projectsApi.members(projectId),
  });
  const members: TeamMember[] = membersData ?? [];

  const isLoading = colsLoading || tasksLoading;

  const grouped = useMemo(() => {
    const m: Record<string, Task[]> = {};
    columns.forEach(c => { m[c.column_id] = []; });
    tasks.forEach(t => {
      const key = t.column_id && m[t.column_id] !== undefined ? t.column_id : columns[0]?.column_id;
      if (key) { m[key] = m[key] || []; m[key].push(t); }
    });
    return m;
  }, [tasks, columns]);

  const openTask = useCallback((taskId: string) => {
    nav.navigate('TaskDetail', { taskId });
  }, [nav]);

  const onCreated = () => {
    setAdding(false);
    qc.invalidateQueries({ queryKey: ['tasks', projectId] });
  };

  // ── Render views ────────────────────────────────────────────────────────────
  const renderBoard = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {columns.map(col => (
        <View key={col.column_id} style={[s.column, { borderTopColor: col.color }]}>
          <View style={s.colHeader}>
            <View style={[s.colDot, { backgroundColor: col.color }]} />
            <Text style={[s.colName, { color: t.ink }]}>{col.name}</Text>
            <View style={[s.colBadge, { backgroundColor: col.color + '22' }]}>
              <Text style={{ color: col.color, fontSize: 11, fontWeight: '800' }}>{grouped[col.column_id]?.length ?? 0}</Text>
            </View>
          </View>
          <FlatList
            data={grouped[col.column_id]}
            keyExtractor={item => item.task_id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={[s.emptyCol, { color: t.ink4 }]}>No tasks</Text>}
            renderItem={({ item }) => (
              <BoardCard task={item} col={col} onPress={() => openTask(item.task_id)} />
            )}
          />
        </View>
      ))}
    </ScrollView>
  );

  const renderList = () => (
    <FlatList
      data={tasks}
      keyExtractor={t => t.task_id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
      ListEmptyComponent={<Text style={[s.empty, { color: t.ink3 }]}>No tasks yet.</Text>}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={t.primary} />}
      renderItem={({ item }) => {
        const col = columns.find(c => c.column_id === item.column_id);
        const pri = PRIORITY_COLOR[item.priority] ?? '#636366';
        return (
          <TouchableOpacity
            style={[s.listRow, { backgroundColor: t.surface, borderColor: t.outline }]}
            onPress={() => openTask(item.task_id)}
            activeOpacity={0.75}
          >
            <View style={[s.listStatus, { backgroundColor: (col?.color ?? t.ink4) + '22' }]}>
              <Text style={{ color: col?.color ?? t.ink3, fontSize: 9, fontWeight: '800' }} numberOfLines={1}>{col?.name ?? '—'}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.listTitle, { color: t.ink }]} numberOfLines={1}>{item.title}</Text>
              {item.due_at && <Text style={[s.listDue, { color: t.ink3 }]}>{format(new Date(item.due_at), 'd MMM yyyy')}</Text>}
            </View>
            <View style={[s.priDot, { backgroundColor: pri }]} />
          </TouchableOpacity>
        );
      }}
    />
  );

  const renderSchedule = () => {
    const sorted = [...tasks].filter(t => t.due_at).sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
    return (
      <FlatList
        data={sorted}
        keyExtractor={t => t.task_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
        ListEmptyComponent={<Text style={[s.empty, { color: t.ink3 }]}>No tasks with due dates.</Text>}
        renderItem={({ item }) => {
          const col = columns.find(c => c.column_id === item.column_id);
          const d   = new Date(item.due_at!);
          const isLate = isPast(d) && !isToday(d);
          return (
            <TouchableOpacity
              style={[s.schedRow, { backgroundColor: t.surface, borderColor: t.outline }]}
              onPress={() => openTask(item.task_id)}
              activeOpacity={0.75}
            >
              <View style={s.schedDate}>
                <Text style={[s.schedDay, { color: isLate ? '#ef4444' : (col?.color ?? '#0082c6') }]}>{format(d, 'd')}</Text>
                <Text style={[s.schedMon, { color: t.ink3 }]}>{format(d, 'MMM')}</Text>
              </View>
              <View style={[s.schedBar, { backgroundColor: col?.color ?? '#0082c6' }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.listTitle, { color: t.ink }]} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: col?.color ?? t.ink3, fontSize: 10, fontWeight: '700' }}>{col?.name ?? '—'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  const renderTracker = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {columns.map(col => {
        const count = (grouped[col.column_id] ?? []).length;
        const pct   = tasks.length ? count / tasks.length : 0;
        return (
          <View key={col.column_id} style={{ gap: 6, marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[s.trackerLabel, { color: col.color }]}>{col.name}</Text>
              <Text style={[s.trackerCount, { color: t.ink }]}>{count}</Text>
            </View>
            <View style={[s.trackerTrack, { backgroundColor: t.outline }]}>
              <LinearGradient
                colors={['#0082c6', '#05b7aa']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.trackerBar, { width: `${pct * 100}%`, backgroundColor: col.color }]}
              />
            </View>
          </View>
        );
      })}
      <View style={[s.trackerTotal, { borderTopColor: t.outline }]}>
        <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '700' }}>TOTAL</Text>
        <Text style={{ color: t.primary, fontSize: 28, fontWeight: '900' }}>{tasks.length}</Text>
      </View>
    </ScrollView>
  );

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.projDot, { backgroundColor: colColor }]} />
            <Text style={[s.headerTitle, { color: t.ink }]} numberOfLines={1}>{projectName}</Text>
          </View>
          <Text style={[s.headerSub, { color: t.ink3 }]}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => setAdding(true)}>
          <LinearGradient colors={['#0082c6', '#05b7aa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addBtn}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addText}>Task</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── View toggle ── */}
      <View style={[s.viewBar, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.viewBarInner}>
          {VIEWS.map(v => (
            <TouchableOpacity
              key={v}
              onPress={() => setView(v)}
              style={[s.viewPill, view === v && { backgroundColor: t.primaryContainer, borderColor: t.primary }]}
            >
              <Text style={[s.viewPillText, { color: view === v ? t.primary : t.ink3 }]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.primary} size="large" />
        </View>
      ) : (
        <>
          {view === 'Board'    && renderBoard()}
          {view === 'List'     && renderList()}
          {view === 'Schedule' && renderSchedule()}
          {view === 'Tracker'  && renderTracker()}
        </>
      )}

      {/* ── New task modal ── */}
      <NewTaskModal
        visible={adding}
        columns={columns}
        members={members}
        projectId={projectId}
        onClose={() => setAdding(false)}
        onCreated={onCreated}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  // Header
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  backBtn:      { width: 32 },
  projDot:      { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  headerTitle:  { fontSize: 17, fontWeight: '800' },
  headerSub:    { fontSize: 11, fontWeight: '600', marginTop: 1 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  addText:      { color: '#fff', fontSize: 12, fontWeight: '800' },
  // View bar
  viewBar:      { borderBottomWidth: 1 },
  viewBarInner: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  viewPill:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1.5, borderColor: 'transparent' },
  viewPillText: { fontSize: 12, fontWeight: '700' },
  // Board
  column:       { width: 264, paddingHorizontal: 10, paddingTop: 4, borderTopWidth: 3, marginTop: 8 },
  colHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10 },
  colDot:       { width: 8, height: 8, borderRadius: 4 },
  colName:      { fontSize: 13, fontWeight: '800', flex: 1 },
  colBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  emptyCol:     { fontSize: 11, textAlign: 'center', paddingVertical: 20 },
  // Board card
  bCard:        { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  bCardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bCardTitle:   { fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  bCardDesc:    { fontSize: 11, lineHeight: 16, marginTop: 4 },
  bCardMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  bCardMetaText:{ fontSize: 10, fontWeight: '600' },
  priDot:       { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack:{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBar:  { height: 4, borderRadius: 2 },
  progressText: { fontSize: 9, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  // List
  listRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  listStatus:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 64, alignItems: 'center' },
  listTitle:    { fontSize: 13, fontWeight: '700' },
  listDue:      { fontSize: 10, marginTop: 2 },
  // Schedule
  schedRow:     { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1 },
  schedDate:    { alignItems: 'center', width: 36 },
  schedDay:     { fontSize: 22, fontWeight: '900' },
  schedMon:     { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  schedBar:     { width: 3, alignSelf: 'stretch', borderRadius: 2, minHeight: 32 },
  // Tracker
  trackerLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  trackerCount: { fontSize: 14, fontWeight: '900' },
  trackerTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  trackerBar:   { height: 10, borderRadius: 5 },
  trackerTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 16, borderTopWidth: 1 },
  // Modal
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#636366', alignSelf: 'center', marginBottom: 18 },
  sheetTitle:   { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  sheetInput:   { borderRadius: 11, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, marginBottom: 16 },
  sheetLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  colChip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, marginRight: 8, borderWidth: 1.5 },
  priChip:      { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 99, borderWidth: 1.5 },
  sheetBtns:    { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:    { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  cancelText:   { fontSize: 13, fontWeight: '700' },
  createBtn:    { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createText:   { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  empty:        { fontSize: 13, textAlign: 'center', marginTop: 40 },
});
