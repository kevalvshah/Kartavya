import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K, FONT } from '../theme';

export default function ProjectsScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = () => api.get('/teams').then((r) => setProjects(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try { await api.post('/teams', { name: name.trim() }); setName(''); setCreating(false); load(); }
    catch (_) { Alert.alert('Error', 'Could not create project'); }
  };

  const remove = (p) => {
    Alert.alert('Delete project', `Delete "${p.name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api.delete(`/teams/${p.team_id}`).catch(() => {});
        load();
      }},
    ]);
  };

  return (
    <View style={s.root}>
      <KHeader
        title="Projects"
        subtitle="Each has its own board"
        rightAction={
          <TouchableOpacity onPress={() => setCreating(!creating)} style={s.addBtn}>
            <LinearGradient colors={K.gradD} style={s.addBtnInner}>
              <Text style={s.addBtnText}>+ New</Text>
            </LinearGradient>
          </TouchableOpacity>
        }
      />
      {creating && (
        <View style={s.newRow}>
          <TextInput style={s.newInput} value={name} onChangeText={setName}
            placeholder="Project name" placeholderTextColor={K.muted}
            autoFocus onSubmitEditing={create} />
          <TouchableOpacity onPress={create} style={s.newSave}>
            <Text style={{ color: K.blue, fontWeight: '800' }}>Create</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={projects}
        keyExtractor={(p) => p.team_id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No projects yet. Create your first one.</Text>}
        renderItem={({ item: p }) => (
          <TouchableOpacity style={s.card}
            onPress={() => navigation.navigate('Board', { projectId: p.team_id, projectName: p.name })}
            onLongPress={() => remove(p)}>
            <LinearGradient colors={K.gradD} style={s.icon}>
              <Text style={{ color: '#fff', fontSize: 18 }}>⬡</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.date}>{new Date(p.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: K.dark },
  list:       { padding: 20, paddingBottom: 40 },
  empty:      { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  addBtn:     {},
  addBtnInner:{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  newRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 10, backgroundColor: K.card },
  newInput:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.3)', paddingHorizontal: 12, paddingVertical: 10, color: '#fff' },
  newSave:    { paddingHorizontal: 14, paddingVertical: 10 },
  card:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: K.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.25)' },
  icon:       { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name:       { color: '#fff', fontSize: 15, fontWeight: '700' },
  date:       { color: K.muted, fontSize: 11, marginTop: 3 },
  arrow:      { color: K.muted, fontSize: 22 },
});
