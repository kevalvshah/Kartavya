import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K } from '../theme';

export default function TasksScreen() {
  const [tasks, setTasks]   = useState([]);
  const [filter, setFilter] = useState('all');

  const load = () => api.get('/tasks').then((r) => setTasks(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = filter === 'overdue'
    ? tasks.filter((t) => t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done')
    : tasks;

  const toggle = async (t) => {
    try { await api.patch(`/tasks/${t.task_id}/toggle`); load(); }
    catch (_) { Alert.alert('Error', 'Could not update task'); }
  };

  const priorityColor = (p) => ({ urgent: K.danger, high: K.warn, medium: K.blue, low: K.muted }[p] || K.muted);

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
                {t.status === 'done' && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, t.status === 'done' && s.strike]} numberOfLines={2}>{t.title}</Text>
              {t.due_at && <Text style={s.due}>{new Date(t.due_at).toLocaleDateString()}</Text>}
            </View>
            <View style={[s.pri, { backgroundColor: priorityColor(t.priority) + '33' }]}>
              <Text style={{ color: priorityColor(t.priority), fontSize: 9, fontWeight: '800' }}>{t.priority}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: K.dark },
  filters: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  chip:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: K.card, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  chipActive: { backgroundColor: 'rgba(0,130,198,0.12)', borderColor: 'rgba(0,130,198,0.5)' },
  chipText:   { color: K.muted, fontSize: 12, fontWeight: '700' },
  list:    { padding: 16, paddingBottom: 40 },
  empty:   { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  card:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: K.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  check:   { paddingTop: 2 },
  checkBox:{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(0,130,198,0.4)', alignItems: 'center', justifyContent: 'center' },
  title:   { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  strike:  { textDecorationLine: 'line-through', color: K.muted },
  due:     { color: K.muted, fontSize: 10, marginTop: 4 },
  pri:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
