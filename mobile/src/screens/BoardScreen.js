import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K } from '../theme';

const VIEWS = ['Board', 'List', 'Schedule', 'Tracker'];

export default function BoardScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;
  const [columns, setColumns]     = useState([]);
  const [tasks, setTasks]         = useState([]);
  const [view, setView]           = useState('Board');
  const [newTitle, setNewTitle]   = useState('');
  const [newColId, setNewColId]   = useState(null);
  const [adding, setAdding]       = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get(`/projects/${projectId}/columns`),
      api.get('/tasks', { params: { team_id: projectId } }),
    ]).then(([c, t]) => {
      setColumns(c.data);
      setTasks(t.data);
      if (!newColId && c.data.length > 0) setNewColId(c.data[0].column_id);
    }).catch(() => {});
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const m = {};
    columns.forEach((c) => { m[c.column_id] = []; });
    tasks.forEach((t) => {
      const key = t.column_id && m[t.column_id] !== undefined ? t.column_id : columns[0]?.column_id;
      if (key) { m[key] = m[key] || []; m[key].push(t); }
    });
    return m;
  }, [tasks, columns]);

  const createTask = async () => {
    if (!newTitle.trim() || !newColId) return;
    try {
      await api.post('/tasks', { title: newTitle.trim(), column_id: newColId, team_id: projectId, priority: 'medium' });
      setNewTitle(''); setAdding(false); load();
    } catch (_) { Alert.alert('Error', 'Could not create task'); }
  };

  const moveTask = (task, toColId) => Alert.alert(
    'Move task', `Move "${task.title}" to...`,
    columns.filter((c) => c.column_id !== task.column_id).map((c) => ({
      text: c.name,
      onPress: async () => {
        await api.patch(`/tasks/${task.task_id}/move`, { column_id: c.column_id, order: 0 }).catch(() => {});
        load();
      },
    })).concat([{ text: 'Cancel', style: 'cancel' }])
  );

  const priorityColor = (p) => ({ urgent: K.danger, high: K.warn, medium: K.blue, low: K.muted }[p] || K.muted);

  return (
    <View style={s.root}>
      <KHeader
        title={projectName} subtitle="Project board"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={() => setAdding(true)} style={s.addBtn}>
            <LinearGradient colors={K.gradD} style={s.addGrad}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.addText}>Task</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {columns.map((col) => (
            <View key={col.column_id} style={[s.column, { borderTopColor: col.color }]}>
              <View style={s.colHeader}>
                <View style={[s.colDot, { backgroundColor: col.color }]} />
                <Text style={s.colName}>{col.name}</Text>
                <Text style={[s.colCount, { color: col.color }]}>{grouped[col.column_id]?.length ?? 0}</Text>
              </View>
              <FlatList
                data={grouped[col.column_id]}
                keyExtractor={(t) => t.task_id}
                scrollEnabled={false}
                ListEmptyComponent={<Text style={s.emptyCol}>No tasks</Text>}
                renderItem={({ item: t }) => (
                  <TouchableOpacity style={s.taskCard}
                    onLongPress={() => moveTask(t)}>
                    <View style={s.taskTop}>
                      <Text style={s.taskTitle} numberOfLines={2}>{t.title}</Text>
                      <View style={[s.priDot, { backgroundColor: priorityColor(t.priority) }]} />
                    </View>
                    {t.description ? <Text style={s.taskDesc} numberOfLines={2}>{t.description}</Text> : null}
                    {t.due_at ? <Text style={s.taskDue}>{new Date(t.due_at).toLocaleDateString()}</Text> : null}
                    {(t.subtasks || []).length > 0 && (
                      <View style={s.progress}>
                        <View style={s.progressTrack}>
                          <View style={[s.progressBar, { width: `${(t.subtasks.filter((s) => s.is_done).length / t.subtasks.length) * 100}%`, backgroundColor: col.color }]} />
                        </View>
                        <Text style={s.progressText}>{t.subtasks.filter((s) => s.is_done).length}/{t.subtasks.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
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
          ListEmptyComponent={<Text style={s.empty}>No tasks yet.</Text>}
          renderItem={({ item: t }) => {
            const col = columns.find((c) => c.column_id === t.column_id);
            return (
              <View style={s.listRow}>
                <View style={[s.listStatus, { backgroundColor: (col?.color || K.muted) + '33' }]}>
                  <Text style={{ color: col?.color || K.muted, fontSize: 9, fontWeight: '800' }}>{col?.name || '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle} numberOfLines={1}>{t.title}</Text>
                  {t.due_at && <Text style={s.listDue}>{new Date(t.due_at).toLocaleDateString()}</Text>}
                </View>
                <View style={[s.priDot, { backgroundColor: priorityColor(t.priority) }]} />
              </View>
            );
          }}
        />
      )}

      {/* Schedule view */}
      {view === 'Schedule' && (
        <FlatList
          data={tasks.filter((t) => t.due_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))}
          keyExtractor={(t) => t.task_id}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<Text style={s.empty}>No tasks with due dates.</Text>}
          renderItem={({ item: t }) => {
            const col = columns.find((c) => c.column_id === t.column_id);
            return (
              <View style={s.schedRow}>
                <View style={s.schedDate}>
                  <Text style={[s.schedDay, { color: col?.color || K.blue }]}>{new Date(t.due_at).getDate()}</Text>
                  <Text style={s.schedMon}>{new Date(t.due_at).toLocaleString('default', { month: 'short' })}</Text>
                </View>
                <View style={[s.schedBar, { backgroundColor: col?.color || K.blue }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={{ color: col?.color || K.muted, fontSize: 10, marginTop: 2 }}>{col?.name || '—'}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Tracker view */}
      {view === 'Tracker' && (
        <ScrollView contentContainerStyle={s.listContent}>
          {columns.map((col) => {
            const count = (grouped[col.column_id] || []).length;
            const pct = tasks.length ? (count / tasks.length) * 100 : 0;
            return (
              <View key={col.column_id} style={s.trackerRow}>
                <Text style={[s.trackerLabel, { color: col.color }]}>{col.name}</Text>
                <View style={s.trackerBarWrap}>
                  <View style={[s.trackerBar, { width: `${pct}%`, backgroundColor: col.color }]} />
                </View>
                <Text style={s.trackerCount}>{count}</Text>
              </View>
            );
          })}
          <View style={s.trackerTotal}>
            <Text style={{ color: K.muted }}>Total</Text>
            <Text style={{ color: K.blue, fontSize: 20, fontWeight: '900' }}>{tasks.length}</Text>
          </View>
        </ScrollView>
      )}

      {/* Add task modal */}
      <Modal visible={adding} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>New Task</Text>
            <TextInput style={s.modalInput} value={newTitle} onChangeText={setNewTitle}
              placeholder="Task title" placeholderTextColor={K.muted} autoFocus />
            <Text style={s.modalLabel}>Column</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {columns.map((c) => (
                <TouchableOpacity key={c.column_id} onPress={() => setNewColId(c.column_id)}
                  style={[s.colChip, newColId === c.column_id && { backgroundColor: c.color }]}>
                  <Text style={{ color: newColId === c.column_id ? '#fff' : K.muted, fontSize: 12, fontWeight: '700' }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => { setAdding(false); setNewTitle(''); }} style={s.cancelBtn}>
                <Text style={{ color: K.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createTask}>
                <LinearGradient colors={K.gradD} style={s.saveBtn}>
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
  viewBar:       { backgroundColor: K.card, borderBottomWidth: 1, borderBottomColor: 'rgba(0,130,198,0.2)', maxHeight: 48 },
  viewBarContent:{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  viewPill:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1.5, borderColor: 'transparent' },
  viewPillActive:{ backgroundColor: 'rgba(0,130,198,0.12)', borderColor: 'rgba(0,130,198,0.4)' },
  viewPillText:  { fontSize: 12, fontWeight: '700', color: K.muted },
  column:        { width: 260, padding: 12, borderTopWidth: 3, marginTop: 4 },
  colHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, marginBottom: 4 },
  colDot:        { width: 8, height: 8, borderRadius: 4 },
  colName:       { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 },
  colCount:      { fontSize: 13, fontWeight: '900' },
  taskCard:      { backgroundColor: K.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  taskTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  taskTitle:     { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  priDot:        { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  taskDesc:      { color: K.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },
  taskDue:       { color: K.mid, fontSize: 10, marginTop: 6, fontWeight: '600' },
  emptyCol:      { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', paddingVertical: 20 },
  progress:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressBar:   { height: 4, borderRadius: 2 },
  progressText:  { color: K.muted, fontSize: 9, fontWeight: '700', minWidth: 24 },
  listContent:   { padding: 16, paddingBottom: 40 },
  listRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: K.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  listStatus:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 60, alignItems: 'center' },
  listTitle:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  listDue:       { color: K.muted, fontSize: 10, marginTop: 3 },
  schedRow:      { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: K.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  schedDate:     { alignItems: 'center', width: 36 },
  schedDay:      { fontSize: 22, fontWeight: '900' },
  schedMon:      { color: K.muted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  schedBar:      { width: 3, height: '100%', borderRadius: 2, minHeight: 32 },
  empty:         { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  trackerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  trackerLabel:  { width: 100, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  trackerBarWrap:{ flex: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' },
  trackerBar:    { height: 10, borderRadius: 5 },
  trackerCount:  { width: 24, color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  trackerTotal:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,130,198,0.2)' },
  addBtn:        {},
  addGrad:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  addText:       { color: '#fff', fontSize: 12, fontWeight: '800' },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: K.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: 'rgba(0,130,198,0.3)' },
  modalTitle:    { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 16 },
  modalInput:    { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.3)', padding: 12, color: '#fff', fontSize: 14, marginBottom: 14 },
  modalLabel:    { color: K.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  colChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  modalBtns:     { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn:     { padding: 12 },
  saveBtn:       { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
});
