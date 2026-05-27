import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Modal, TextInput, ActivityIndicator,
  Platform, Alert, RefreshControl, KeyboardAvoidingView, Pressable,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday, isPast } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { tasksApi } from '../api/tasks';
import { projectsApi } from '../api/projects';
import { PRIORITY_COLOR, projectColor } from '../theme/tokens';
import type { Task, ProjectColumn, TeamMember, Project } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Route = RouteProp<RootStackParamList, 'Board'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'Board'>;

const VIEWS = ['Board', 'List', 'Schedule', 'Tracker'] as const;
type ViewMode = typeof VIEWS[number];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

// ── Project picker modal ──────────────────────────────────────────────────────
function ProjectPicker({
  visible, projects, activeId, onSelect, onClose, t,
}: {
  visible: boolean; projects: Project[]; activeId: string | null;
  onSelect: (p: Project) => void; onClose: () => void; t: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ps.backdrop} onPress={onClose} />
      <View style={[ps.sheet, { backgroundColor: t.surface }]}>
        <View style={[ps.handle, { backgroundColor: t.outline }]} />
        <Text style={[ps.title, { color: t.ink }]}>Switch Project</Text>
        <Text style={[ps.sub, { color: t.ink3 }]}>परियोजना चुनें</Text>
        <ScrollView style={{ maxHeight: 380 }}>
          {projects.map(p => {
            const color = projectColor(p.team_id, p.color ?? undefined);
            const isActive = p.team_id === activeId;
            return (
              <TouchableOpacity
                key={p.team_id}
                style={[ps.row, { borderBottomColor: t.outline }, isActive && { backgroundColor: t.primaryContainer }]}
                onPress={() => { onSelect(p); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={[ps.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[ps.rowName, { color: t.ink }]}>{p.name}</Text>
                  {p.description ? <Text style={[ps.rowDesc, { color: t.ink3 }]} numberOfLines={1}>{p.description}</Text> : null}
                </View>
                {isActive && <Ionicons name="checkmark" size={18} color={t.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={onClose} style={[ps.cancelBtn, { borderColor: t.outline }]}>
          <Text style={[ps.cancelText, { color: t.ink3 }]}>Cancel · रद्द करें</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Board card ────────────────────────────────────────────────────────────────
function BoardCard({ task, col, onPress }: { task: Task; col?: ProjectColumn; onPress: () => void }) {
  const { t } = useTheme();
  const pri   = PRIORITY_COLOR[task.priority] ?? '#636366';
  const done  = (task.subtasks ?? []).filter(s => s.is_done).length;
  const total = (task.subtasks ?? []).length;
  const isLate = task.due_at ? isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at)) : false;
  const isApproval = col?.name?.toLowerCase().includes('approval');

  return (
    <TouchableOpacity
      style={[bc.card, { backgroundColor: t.surface }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Priority + ID row */}
      <View style={bc.topRow}>
        <View style={[bc.priDot, { backgroundColor: pri }]} />
        <Text style={[bc.priLabel, { color: t.ink3 }]}>{task.priority}</Text>
        {task.approval_status === 'pending' && (
          <View style={bc.ownerChip}>
            <Text style={bc.ownerChipText}>OWNER SIGN-OFF</Text>
          </View>
        )}
        {task.approval_status === 'pending_client' && (
          <View style={[bc.ownerChip, { backgroundColor: 'rgba(167,139,250,0.18)' }]}>
            <Text style={[bc.ownerChipText, { color: '#6B46C1' }]}>CLIENT REVIEW</Text>
          </View>
        )}
        {task.approval_status === 'approved' && (
          <View style={[bc.ownerChip, { backgroundColor: 'rgba(5,183,170,0.16)' }]}>
            <Text style={[bc.ownerChipText, { color: '#0A7A6E' }]}>APPROVED</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={[bc.title, { color: t.ink }]} numberOfLines={2}>{task.title}</Text>

      {/* Footer */}
      <View style={bc.footer}>
        {task.due_at && (
          <View style={[bc.dueChip, {
            backgroundColor: isLate ? 'rgba(239,68,68,0.12)' : 'rgba(0,0,0,0.06)',
          }]}>
            <Ionicons name="calendar-outline" size={10} color={isLate ? '#ef4444' : t.ink3} />
            <Text style={[bc.dueText, { color: isLate ? '#ef4444' : t.ink3 }]}>
              {format(new Date(task.due_at), 'd MMM')}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {/* Comment + attachment counts */}
        {(task.comments_count ?? 0) > 0 && (
          <View style={bc.metaItem}>
            <Ionicons name="chatbubble-outline" size={10} color={t.ink3} />
            <Text style={[bc.metaCount, { color: t.ink3 }]}>{task.comments_count}</Text>
          </View>
        )}
        {((task.attachments ?? []).length) > 0 && (
          <View style={bc.metaItem}>
            <Ionicons name="attach-outline" size={10} color={t.ink3} />
            <Text style={[bc.metaCount, { color: t.ink3 }]}>{task.attachments!.length}</Text>
          </View>
        )}
        {/* Assignee avatars */}
        {(task.assignee_names ?? []).slice(0, 3).map((name, i) => (
          <View key={i} style={[bc.avatar, {
            backgroundColor: ['#0082c6','#05b7aa','#8b5cf6','#f59e0b','#ec4899'][i % 5] + 'cc',
            marginLeft: i > 0 ? -6 : 0,
          }]}>
            <Text style={bc.avatarText}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        ))}
      </View>

      {/* Subtask progress bar */}
      {total > 0 && (
        <View style={bc.progressRow}>
          <View style={[bc.progressTrack, { backgroundColor: t.outline }]}>
            <View style={[bc.progressBar, {
              width: `${(done / total) * 100}%` as any,
              backgroundColor: col?.color ?? '#0082c6',
            }]} />
          </View>
          <Text style={[bc.progressText, { color: t.ink3 }]}>{done}/{total}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── New task modal ────────────────────────────────────────────────────────────
function NewTaskModal({ visible, columns, projectId, onClose, onCreated, t }: {
  visible: boolean; columns: ProjectColumn[]; projectId: string;
  onClose: () => void; onCreated: () => void; t: any;
}) {
  const [title, setTitle]   = useState('');
  const [colId, setColId]   = useState(columns[0]?.column_id ?? '');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (columns.length && !colId) setColId(columns[0].column_id);
  }, [columns]);

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        column_id: colId || columns[0]?.column_id,
        team_id: projectId,
        priority,
      });
      setTitle(''); setPriority('medium');
      onCreated();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={s.overlay} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: t.surface, borderColor: t.outline }]}>
          <View style={[s.sheetHandle, { backgroundColor: t.outline }]} />
          <Text style={[s.sheetTitle, { color: t.ink }]}>New Task</Text>
          <TextInput
            style={[s.sheetInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
            value={title} onChangeText={setTitle}
            placeholder="Task title" placeholderTextColor={t.ink3}
            autoFocus returnKeyType="done"
          />
          <Text style={[s.sheetLabel, { color: t.ink3 }]}>COLUMN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {columns.map(c => (
              <TouchableOpacity key={c.column_id} onPress={() => setColId(c.column_id)}
                style={[s.colChip, { backgroundColor: colId === c.column_id ? c.color : t.bg, borderColor: c.color }]}>
                <Text style={{ color: colId === c.column_id ? '#fff' : c.color, fontSize: 12, fontWeight: '700' }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[s.sheetLabel, { color: t.ink3 }]}>PRIORITY</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {PRIORITIES.map(p => {
              const pc = PRIORITY_COLOR[p]; const active = priority === p;
              return (
                <TouchableOpacity key={p} onPress={() => setPriority(p)}
                  style={[s.priChip, { backgroundColor: active ? pc : pc + '22', borderColor: pc }]}>
                  <Text style={{ color: active ? '#fff' : pc, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.sheetBtns}>
            <TouchableOpacity onPress={onClose} style={[s.cancelBtn, { borderColor: t.outline }]}>
              <Text style={[s.cancelText, { color: t.ink3 }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={create} disabled={!title.trim() || saving} style={{ flex: 1 }}>
              <LinearGradient colors={['#0082c6','#05b7aa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.createBtn, (!title.trim() || saving) && { opacity: 0.5 }]}>
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
  const { t }   = useTheme();
  const nav     = useNavigation<Nav>();
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();

  // route params are optional — when used as Boards tab, params may be undefined
  const route = useRoute<Route>();
  const routeParams = route.params ?? {};
  const isTabMode = !routeParams.projectId;

  // ── Projects ────────────────────────────────────────────────────────────────
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    staleTime: 60_000,
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    routeParams.projectId ?? null
  );
  const [showPicker, setShowPicker] = useState(false);
  const [view, setView] = useState<ViewMode>('Board');
  const [adding, setAdding] = useState(false);

  // Initialise to first project when loaded (tab mode only)
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].team_id);
    }
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => p.team_id === activeProjectId);
  const projectId     = activeProjectId ?? '';
  const colColor      = projectColor(projectId, activeProject?.color ?? undefined);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: columns = [], isLoading: colsLoading } = useQuery({
    queryKey: ['columns', projectId],
    queryFn:  () => projectsApi.columns(projectId),
    enabled:  !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn:  () => tasksApi.list({ team_id: projectId }),
    enabled:  !!projectId,
  });

  const isLoading = colsLoading || tasksLoading;

  const grouped = useMemo(() => {
    const m: Record<string, Task[]> = {};
    columns.forEach(c => { m[c.column_id] = []; });
    tasks.forEach(task => {
      const key = task.column_id && m[task.column_id] !== undefined
        ? task.column_id : columns[0]?.column_id;
      if (key) { m[key] = m[key] || []; m[key].push(task); }
    });
    return m;
  }, [tasks, columns]);

  const openTask = useCallback((taskId: string) => {
    nav.navigate('TaskDetail', { taskId });
  }, [nav]);

  const onCreated = useCallback(() => {
    setAdding(false);
    qc.invalidateQueries({ queryKey: ['tasks', projectId] });
  }, [qc, projectId]);

  // ── Views ────────────────────────────────────────────────────────────────────
  const renderBoard = useCallback(() => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
      {columns.map(col => (
        <View key={col.column_id} style={[s.column]}>
          {/* Column header */}
          <View style={s.colHeader}>
            <View style={[s.colDot, { backgroundColor: col.color }]} />
            <Text style={[s.colName, { color: t.ink }]}>{col.name}</Text>
            <View style={[s.colBadge, { backgroundColor: col.color + '22' }]}>
              <Text style={{ color: col.color, fontSize: 11, fontWeight: '800' }}>
                {grouped[col.column_id]?.length ?? 0}
              </Text>
            </View>
          </View>
          {/* Approval hint */}
          {col.name?.toLowerCase().includes('approval') && (
            <View style={[s.approvalHint, { backgroundColor: 'rgba(255,159,10,0.10)' }]}>
              <Ionicons name="sparkles-outline" size={12} color="#B06A00" />
              <Text style={s.approvalHintText}>Cards here notify the owner for sign-off.</Text>
            </View>
          )}
          {/* Cards */}
          {(grouped[col.column_id] ?? []).length === 0
            ? <Text style={[s.emptyCol, { color: t.ink4 }]}>No tasks</Text>
            : (grouped[col.column_id] ?? []).map(item => (
                <BoardCard key={item.task_id} task={item} col={col} onPress={() => openTask(item.task_id)} />
              ))
          }
          {/* Add card button */}
          <TouchableOpacity
            style={[s.addCardBtn, { borderColor: t.outline }]}
            onPress={() => setAdding(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={14} color={t.ink3} />
            <Text style={[s.addCardText, { color: t.ink3 }]}>Add card to "{col.name}"</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  ), [columns, grouped, t, openTask]);

  const renderList = useCallback(() => (
    <FlatList
      data={tasks}
      keyExtractor={task => task.task_id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
      ListEmptyComponent={<Text style={[s.empty, { color: t.ink3 }]}>No tasks yet.</Text>}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={t.primary} />}
      renderItem={({ item }) => {
        const col = columns.find(c => c.column_id === item.column_id);
        const pri = PRIORITY_COLOR[item.priority] ?? '#636366';
        return (
          <TouchableOpacity style={[s.listRow, { backgroundColor: t.surface, borderColor: t.outline }]}
            onPress={() => openTask(item.task_id)} activeOpacity={0.75}>
            <View style={[s.listStatus, { backgroundColor: (col?.color ?? t.ink4) + '22' }]}>
              <Text style={{ color: col?.color ?? t.ink3, fontSize: 9, fontWeight: '800' }} numberOfLines={1}>{col?.name ?? '—'}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.listTitle, { color: t.ink }]} numberOfLines={1}>{item.title}</Text>
              {item.due_at && <Text style={[s.listDue, { color: t.ink3 }]}>{format(new Date(item.due_at), 'd MMM yyyy')}</Text>}
            </View>
            <View style={[s.priDotSm, { backgroundColor: pri }]} />
          </TouchableOpacity>
        );
      }}
    />
  ), [tasks, columns, t, isFetching, isLoading, refetch, openTask]);

  const renderSchedule = useCallback(() => {
    const sorted = [...tasks].filter(task => task.due_at).sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
    return (
      <FlatList data={sorted} keyExtractor={task => task.task_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
        ListEmptyComponent={<Text style={[s.empty, { color: t.ink3 }]}>No tasks with due dates.</Text>}
        renderItem={({ item }) => {
          const col = columns.find(c => c.column_id === item.column_id);
          const d = new Date(item.due_at!); const isLate = isPast(d) && !isToday(d);
          return (
            <TouchableOpacity style={[s.schedRow, { backgroundColor: t.surface, borderColor: t.outline }]}
              onPress={() => openTask(item.task_id)} activeOpacity={0.75}>
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
  }, [tasks, columns, t, openTask]);

  const renderTracker = useCallback(() => (
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
              <LinearGradient colors={['#0082c6','#05b7aa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.trackerBar, { width: `${pct * 100}%` as any }]} />
            </View>
          </View>
        );
      })}
      <View style={[s.trackerTotal, { borderTopColor: t.outline }]}>
        <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '700' }}>TOTAL</Text>
        <Text style={{ color: t.primary, fontSize: 28, fontWeight: '900' }}>{tasks.length}</Text>
      </View>
    </ScrollView>
  ), [columns, grouped, tasks, t]);

  // ── No projects state ────────────────────────────────────────────────────────
  if (!isLoading && projects.length === 0) {
    return (
      <View style={[s.root, { backgroundColor: t.bg }]}>
        <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline, paddingTop: insets.top + 12 }]}>
          <Text style={[s.headerTitle, { color: t.ink }]}>Boards</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="grid-outline" size={40} color={t.ink3} />
          <Text style={[s.empty, { color: t.ink3 }]}>No projects yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline, paddingTop: insets.top + 12 }]}>
        {/* Back button (stack mode only) */}
        {!isTabMode && (
          <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={t.ink} />
          </TouchableOpacity>
        )}

        {/* Project selector */}
        <TouchableOpacity style={s.projectBtn} onPress={() => setShowPicker(true)} activeOpacity={0.75}>
          <View style={[s.projDot, { backgroundColor: colColor }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.headerTitle, { color: t.ink }]} numberOfLines={1}>
              {activeProject?.name ?? 'Select Project'}
            </Text>
            <Text style={[s.headerSub, { color: t.ink3 }]}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              {activeProject?.description ? ` · ${activeProject.description}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={t.ink3} />
        </TouchableOpacity>

        {/* Add task button */}
        <TouchableOpacity onPress={() => setAdding(true)} disabled={!projectId}>
          <LinearGradient colors={['#0082c6','#05b7aa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addBtn}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addText}>Task</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── View toggle ── */}
      <View style={[s.viewBar, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
        <View style={[s.segControl, { backgroundColor: t.surfaceLow ?? t.bg }]}>
          {VIEWS.map((v, i) => (
            <TouchableOpacity
              key={v}
              onPress={() => setView(v)}
              style={[s.segItem, view === v && { backgroundColor: t.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 }]}
            >
              <Text style={[s.segText, { color: view === v ? t.ink : t.ink3, fontWeight: view === v ? '700' : '500' }]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Column filter tabs (board view only) ── */}
      {view === 'Board' && columns.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={[s.colTabs, { borderBottomColor: t.outline }]}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingVertical: 8 }}>
          {columns.map(col => (
            <View key={col.column_id} style={[s.colTab, { borderColor: col.color + '44' }]}>
              <View style={[s.colTabDot, { backgroundColor: col.color }]} />
              <Text style={[s.colTabText, { color: t.ink2 }]}>{col.name}</Text>
              <Text style={[s.colTabCount, { color: col.color }]}>{grouped[col.column_id]?.length ?? 0}</Text>
            </View>
          ))}
        </ScrollView>
      )}

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

      {/* ── Project picker ── */}
      <ProjectPicker
        visible={showPicker}
        projects={projects}
        activeId={activeProjectId}
        onSelect={p => setActiveProjectId(p.team_id)}
        onClose={() => setShowPicker(false)}
        t={t}
      />

      {/* ── New task modal ── */}
      {projectId && (
        <NewTaskModal
          visible={adding}
          columns={columns}
          projectId={projectId}
          onClose={() => setAdding(false)}
          onCreated={onCreated}
          t={t}
        />
      )}
    </View>
  );
}

// ── Project picker styles ─────────────────────────────────────────────────────
const ps = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 20 },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  title:      { fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  sub:        { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingLeft: 8 },
  dot:        { width: 12, height: 12, borderRadius: 4, flexShrink: 0 },
  rowName:    { fontSize: 15, fontWeight: '600' },
  rowDesc:    { fontSize: 12, marginTop: 2 },
  cancelBtn:  { borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  cancelText: { fontSize: 14, fontWeight: '600' },
});

// ── Board card styles ─────────────────────────────────────────────────────────
const bc = StyleSheet.create({
  card:         { borderRadius: 14, padding: 14, marginBottom: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  priDot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  priLabel:     { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  ownerChip:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,159,10,0.18)' },
  ownerChipText:{ fontSize: 9, fontWeight: '700', color: '#B06A00', letterSpacing: 0.3 },
  title:        { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 10 },
  footer:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueChip:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  dueText:      { fontSize: 10, fontWeight: '600' },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaCount:    { fontSize: 10, fontWeight: '600' },
  avatar:       { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 9, fontWeight: '800', color: '#fff' },
  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressTrack:{ flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressBar:  { height: 3, borderRadius: 2 },
  progressText: { fontSize: 9, fontWeight: '700', minWidth: 24, textAlign: 'right' },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1 },
  // Header
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  backBtn:      { width: 32, flexShrink: 0 },
  projectBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  projDot:      { width: 10, height: 10, borderRadius: 4, flexShrink: 0 },
  headerTitle:  { fontSize: 16, fontWeight: '800' },
  headerSub:    { fontSize: 11, fontWeight: '500', marginTop: 1 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  addText:      { color: '#fff', fontSize: 12, fontWeight: '800' },
  // View toggle (segmented control)
  viewBar:      { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 8 },
  segControl:   { flexDirection: 'row', borderRadius: 10, padding: 2, overflow: 'hidden' },
  segItem:      { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8 },
  segText:      { fontSize: 12 },
  // Column tabs
  colTabs:      { borderBottomWidth: StyleSheet.hairlineWidth },
  colTab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  colTabDot:    { width: 6, height: 6, borderRadius: 3 },
  colTabText:   { fontSize: 12, fontWeight: '600' },
  colTabCount:  { fontSize: 10, fontWeight: '800' },
  // Board columns
  column:       { width: 270, paddingHorizontal: 10, paddingTop: 8 },
  colHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, paddingHorizontal: 2 },
  colDot:       { width: 8, height: 8, borderRadius: 4 },
  colName:      { fontSize: 13, fontWeight: '800', flex: 1 },
  colBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  approvalHint: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: '8px 10px' as any, borderRadius: 10, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8 },
  approvalHintText: { fontSize: 11, color: '#B06A00', lineHeight: 15, flex: 1 },
  emptyCol:     { fontSize: 11, textAlign: 'center', paddingVertical: 20 },
  addCardBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4, marginBottom: 8 },
  addCardText:  { fontSize: 12, fontWeight: '600' },
  // List
  listRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  listStatus:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 64, alignItems: 'center' },
  listTitle:    { fontSize: 13, fontWeight: '700' },
  listDue:      { fontSize: 10, marginTop: 2 },
  priDotSm:     { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
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
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
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
  // shared
  sheetColor:   {},
});
