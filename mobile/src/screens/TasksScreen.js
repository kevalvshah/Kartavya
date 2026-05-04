import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K, FONT } from '../theme';

const PRIORITY_COLOR = { urgent: K.danger, high: K.warn, medium: K.blue, low: K.muted };
const STATUS_COLOR   = { todo: K.blue, in_progress: K.mid, in_review: '#8b5cf6', approval: K.warn, done: K.teal };

export default function TasksScreen() {
  const [tasks, setTasks]   = useState([]);
  const [filter, setFilter] = useState('all'); // all | mine | overdue

  const load = () => api.get('/tasks').then((r) => setTasks(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = tasks.filter((t) => {
    if (filter === 'overdue') return t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done';
    return true;
  });

  const toggle = async (t) => {
    try { await api.patch(`/tasks/${t.task_id}/toggle`); load(); }
    catch (_) { Alert.alert('Error', 'Could not update task'); }
  };

  return (
    <View style={s.root}>
      <KHeader title="All Tasks" subtitle="Personal + project tasks" />
      <View style={s.filters}>
        {['all', 'overdue'].map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[s.chip, filter === f && s.chipActive]}>
            <Text style={[s.chipText, filter === f && { color: K.blue }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.task_id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No tasks found.</Text>}
        renderItem={({ item: t }) => (
          <View style={s.card}>
            <TouchableOpacity onPress={() => toggle(t)} style={s.check}>
              <View style={[s.checkBox, t.status === 'done' && { backgroundColor: K.teal, borderColor: K.teal }]}>
                {t.status === 'done' && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, t.status === 'done' && s.strikethrough]} numberOfLines={2}>{t.title}</Text>
              <View style={s.meta}>
                <View style={[s.statusPill, { backgroundColor: (STATUS_COLOR[t.column_slug || t.status] || K.muted) + '22' }]}>
                  <Text style={{ color: STATUS_COLOR[t.column_slug || t.status] || K.muted, fontSize: 9, fontWeight: '800' }}>{t.status}</Text>
                </View>
                {t.due_at && <Text style={s.due}>{new Date(t.due_at).toLocaleDateString()}</Text>}
              </View>
            </View>
            <View style={[s.pri, { backgroundColor: (PRIORITY_COLOR[t.priority] || K.muted) + '33' }]}>
              <Text style={{ color: PRIORITY_COLOR[t.priority] || K.muted, fontSize: 9, fontWeight: '800' }}>{t.priority}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: K.dark },
  filters:     { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: K.card, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  chipActive:  { backgroundColor: 'rgba(0,130,198,0.12)', borderColor: 'rgba(0,130,198,0.5)' },
  chipText:    { color: K.muted, fontSize: 12, fontWeight: '700' },
  list:        { padding: 16, paddingBottom: 40 },
  empty:       { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  card:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: K.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  check:       { paddingTop: 2 },
  checkBox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(0,130,198,0.4)', alignItems: 'center', justifyContent: 'center' },
  title:       { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  strikethrough:{ textDecorationLine: 'line-through', color: K.muted },
  meta:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  statusPill:  { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  due:         { color: K.muted, fontSize: 10 },
  pri:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
