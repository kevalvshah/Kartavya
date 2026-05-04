import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Modal, TextInput, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K, FONT } from '../theme';

const DEFAULT_COLS = [
  { slug:'todo',        name:'To Do',       color: K.blue },
  { slug:'in_progress', name:'In Progress', color: K.mid },
  { slug:'in_review',   name:'In Review',   color: '#8b5cf6' },
  { slug:'approval',    name:'Approval',    color: '#f59e0b' },
  { slug:'done',        name:'Done',        color: K.teal },
];

const VIEWS = ['Board', 'List', 'Schedule', 'Tracker'];

export default function BoardScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;
  const [tasks, setTasks]         = useState([]);
  const [view, setView]           = useState('Board');
  const [newTitle, setNewTitle]   = useState('');
  const [newCol, setNewCol]       = useState('todo');
  const [adding, setAdding]       = useState(false);
  const [cats, setCats]           = useState([]);

  const load = useCallback(() => {
    api.get('/tasks', { params: { team_id: projectId } }).then((r) => setTasks(r.data)).catch(() => {});
    api.get('/categories').then((r) => setCats(r.data)).catch(() => {});
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const m = {};
    DEFAULT_COLS.forEach((c) => { m[c.slug] = []; });
    tasks.forEach((t) => {
      const slug = t.column_slug || t.status;
      if (m[slug]) m[slug].push(t);
      else { m['todo'] = m['todo'] || []; m['todo'].push(t); }
    });
    return m;
  }, [tasks]);

  const createTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await api.post('/tasks', { title: newTitle.trim(), status: newCol, team_id: projectId, priority: 'medium' });
      setNewTitle(''); setAdding(false); load();
    } catch (_) { Alert.alert('Error', 'Could not create task'); }
  };

  const moveTask = async (task, toSlug) => {
    try {
      await api.patch(`/tasks/${task.task_id}/move`, { status: toSlug, order: 0 });
      load();
    } catch (_) {}
  };

  const catName = (id) => cats.find((c) => c.category_id === id)?.name || '';
  const priorityColor = (p) => ({ urgent: K.danger, high: K.warn, medium: K.blue, low: K.muted }[p] || K.muted);

  return (
    <View style={s.root}>
      <KHeader
        title={projectName}
        subtitle="Project board"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={() => setAdding(true)} style={s.addBtn}>
            <LinearGradient colors={K.gradD} style={s.addBtnInner}>
              <Text style={s.addBtnText}>+ Task</Text>
            </LinearGradient>
          </TouchableOpacity>
        }
      />

      {/* View toggle */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.viewBar} contentContainerStyle={s.viewBarContent}>
        {VIEWS.map((v) => (
          <TouchableOpacity key={v} onPress={() => setView(v)}
            style={[s.viewPill, view === v && s.viewPillActive]}>
            <Text style={[s.viewPillText, view === v && { color: K.blue }]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Board view */}
      {view === 'Board' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.boardScroll}>
          {DEFAULT_COLS.map((col) => (
            <View key={col.slug} style={s.column}>
              <View style={[s.colHeader, { borderLeftColor: col.color }]}>
                <View style={[s.colDot, { backgroundColor: col.color }]} />
                <Text style={s.colName}>{col.name}</Text>
                <Text style={[s.colCount, { color: col.color }]}>{grouped[col.slug]?.length ?? 0}</Text>
              </View>
              <FlatList
                data={grouped[col.slug]}
                keyExtractor={(t) => t.task_id}
                scrollEnabled={false}
                renderItem={({ item: t }) => (
                  <TouchableOpacity style={s.taskCard} onLongPress={() => {
                    Alert.alert('Move task', 'Move to which column?',
                      DEFAULT_COLS.filter((c) => c.slug !== col.slug).map((c) => ({
                        text: c.name, onPress: () => moveTask(t, c.slug)
                      })).concat([{ text: 'Cancel', style: 'cancel' }])
                    );
                  }}>
                    <View style={s.taskTop}>
                      <Text style={s.taskTitle} numberOfLines={2}>{t.title}</Text>
                      <View style={[s.priDot, { backgroundColor: priorityColor(t.priority) }]} />
                    </View>
                    {t.description ? <Text style={s.taskDesc} numberOfLines={2}>{t.description}</Text> : null}
                    {t.due_at ? <Text style={s.taskDue}>Due {new Date(t.due_at).toLocaleDateString()}</Text> : null}
                    {catName(t.category_id) ? <Text style={s.taskCat}>{catName(t.category_id)}</Text> : null}
                    {(t.subtasks || []).length > 0 && (
                      <View style={s.progress}>
                        <View style={s.progressTrack}>
                          <View style={[s.progressBar, { width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%` }]} />
                        </View>
                        <Text style={s.progressText}>{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={s.emptyCol}>Drop tasks here</Text>}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* List view */}
      {view === 'List' && (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.task_id}
          contentContainerStyle={s.listContent}
          renderItem={({ item: t }) => (
            <View style={s.listRow}>
              <View style={[s.listStatus, { backgroundColor: (DEFAULT_COLS.find((c) => c.slug === (t.column_slug || t.status))?.color || K.muted) + '33' }]}>
                <Text style={{ color: DEFAULT_COLS.find((c) => c.slug === (t.column_slug || t.status))?.color || K.muted, fontSize: 9, fontWeight: '800' }}>
                  {DEFAULT_COLS.find((c) => c.slug === (t.column_slug || t.status))?.name || t.status}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.listTitle}>{t.title}</Text>
                {t.due_at && <Text style={s.listDue}>{new Date(t.due_at).toLocaleDateString()}</Text>}
              </View>
              <View style={[s.priDot, { backgroundColor: priorityColor(t.priority) }]} />
            </View>
          )}
        />
      )}

      {/* Schedule view */}
      {view === 'Schedule' && (
        <ScrollView contentContainerStyle={s.listContent}>
          {tasks.filter((t) => t.due_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).map((t) => (
            <View key={t.task_id} style={s.schedRow}>
              <View style={s.schedDate}>
                <Text style={s.schedDay}>{new Date(t.due_at).getDate()}</Text>
                <Text style={s.schedMon}>{new Date(t.due_at).toLocaleString('default', { month: 'short' })}</Text>
              </View>
              <View style={s.schedInfo}>
                <Text style={s.listTitle}>{t.title}</Text>
                <Text style={{ color: K.muted, fontSize: 11 }}>{DEFAULT_COLS.find((c) => c.slug === (t.column_slug || t.status))?.name || t.status}</Text>
              </View>
            </View>
          ))}
          {tasks.filter((t) => t.due_at).length === 0 && <Text style={s.empty}>No tasks with due dates.</Text>}
        </ScrollView>
      )}

      {/* Tracker view */}
      {view === 'Tracker' && (
        <ScrollView contentContainerStyle={s.listContent}>
          {DEFAULT_COLS.map((col) => (
            <View key={col.slug} style={s.trackerRow}>
              <Text style={[s.trackerLabel, { color: col.color }]}>{col.name}</Text>
              <View style={s.trackerBar}>
                <View style={[s.trackerFill, {
                  width: `${tasks.length ? (grouped[col.slug]?.length / tasks.length) * 100 : 0}%`,
                  backgroundColor: col.color,
                }]} />
              </View>
              <Text style={s.trackerCount}>{grouped[col.slug]?.length ?? 0}</Text>
            </View>
          ))}
          <View style={s.trackerTotal}>
            <Text style={s.trackerTotalLabel}>Total tasks</Text>
            <Text style={[s.trackerTotalNum, { color: K.blue }]}>{tasks.length}</Text>
          </View>
        </ScrollView>
      )}

      {/* Add task modal */}
      <Modal visible={adding} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>New Task</Text>
            <TextInput style={s.modalInput} value={newTitle} onChangeText={setNewTitle}
              placeholder="Task title" placeholderTextColor={K.muted} autoFocus />
            <Text style={s.modalLabel}>Column</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {DEFAULT_COLS.map((c) => (
                <TouchableOpacity key={c.slug} onPress={() => setNewCol(c.slug)}
                  style={[s.colChip, newCol === c.slug && { backgroundColor: c.color }]}>
                  <Text style={{ color: newCol === c.slug ? '#fff' : K.muted, fontSize: 12, fontWeight: '700' }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => { setAdding(false); setNewTitle(''); }} style={s.modalCancel}>
                <Text style={{ color: K.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createTask}>
                <LinearGradient colors={K.gradD} style={s.modalSave}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: K.dark },
  viewBar:       { backgroundColor: K.card, borderBottomWidth: 1, borderBottomColor: 'rgba(0,130,198,0.2)' },
  viewBarContent:{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  viewPill:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1.5, borderColor: 'transparent' },
  viewPillActive:{ backgroundColor: 'rgba(0,130,198,0.12)', borderColor: 'rgba(0,130,198,0.4)' },
  viewPillText:  { fontSize: 12, fontWeight: '700', color: K.muted },
  boardScroll:   { flex: 1 },
  column:        { width: 260, padding: 12 },
  colHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, borderLeftWidth: 3, paddingLeft: 10, marginBottom: 6 },
  colDot:        { width: 8, height: 8, borderRadius: 4 },
  colName:       { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 },
  colCount:      { fontSize: 13, fontWeight: '900' },
  taskCard:      { backgroundColor: K.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  taskTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  taskTitle:     { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  priDot:        { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  taskDesc:      { color: K.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },
  taskDue:       { color: K.mid, fontSize: 10, marginTop: 6, fontWeight: '600' },
  taskCat:       { color: K.muted, fontSize: 10, marginTop: 4 },
  emptyCol:      { color: 'rgba(255,255,255,0.15)', fontSize: 11, textAlign: 'center', paddingVertical: 20 },
  progress:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressBar:   { height: 4, backgroundColor: K.teal, borderRadius: 2 },
  progressText:  { color: K.muted, fontSize: 9, fontWeight: '700', minWidth: 24 },
  listContent:   { padding: 16, paddingBottom: 40 },
  listRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: K.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  listStatus:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  listTitle:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  listDue:       { color: K.muted, fontSize: 10, marginTop: 3 },
  schedRow:      { flexDirection: 'row', gap: 14, backgroundColor: K.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  schedDate:     { alignItems: 'center', width: 40 },
  schedDay:      { color: K.blue, fontSize: 22, fontWeight: '900' },
  schedMon:      { color: K.muted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  schedInfo:     { flex: 1 },
  empty:         { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  trackerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  trackerLabel:  { width: 90, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  trackerBar:    { flex: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' },
  trackerFill:   { height: 10, borderRadius: 5 },
  trackerCount:  { width: 24, color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  trackerTotal:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,130,198,0.2)' },
  trackerTotalLabel: { color: K.muted, fontSize: 13 },
  trackerTotalNum:   { fontSize: 20, fontWeight: '900' },
  addBtn:        {},
  addBtnInner:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  addBtnText:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: K.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: 'rgba(0,130,198,0.3)' },
  modalTitle:    { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 16 },
  modalInput:    { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.3)', padding: 12, color: '#fff', fontSize: 14, marginBottom: 14 },
  modalLabel:    { color: K.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  colChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  modalBtns:     { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel:   { padding: 12 },
  modalSave:     { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
});
