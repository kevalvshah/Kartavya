import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useNavigation } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import KHeader from '../components/KHeader';
import { api } from '../api';
import { K } from '../theme';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [summary, setSummary]   = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => {});
    api.get('/teams').then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  const stats = [
    { label: 'Todo',        value: summary?.todo        ?? '—', color: K.blue },
    { label: 'In Progress', value: summary?.in_progress ?? '—', color: K.mid },
    { label: 'Done',        value: summary?.done        ?? '—', color: K.teal },
    { label: 'Overdue',     value: summary?.overdue     ?? '—', color: K.danger },
  ];

  return (
    <View style={s.root}>
      <KHeader title="Dashboard" subtitle="Plan, ship, repeat." />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.statsGrid}>
          {stats.map((st) => (
            <View key={st.label} style={[s.statCard, { borderColor: st.color + '55' }]}>
              <Text style={[s.statNum, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Recent Projects</Text>
        {projects.length === 0
          ? <Text style={s.empty}>No projects yet.</Text>
          : projects.slice(0, 5).map((p) => (
            <TouchableOpacity key={p.team_id} style={s.projRow}
              onPress={() => navigation.navigate('Board', { projectId: p.team_id, projectName: p.name })}>
              <LinearGradient colors={K.gradD} style={s.projIcon}>
                <Ionicons name="folder" size={16} color="#fff" />
              </LinearGradient>
              <Text style={s.projName}>{p.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={K.muted} />
            </TouchableOpacity>
          ))
        }

        <View style={s.dueCard}>
          <Text style={s.dueTitle}>Due in 24h</Text>
          <Text style={[s.dueNum, { color: K.mid }]}>{summary?.due_24h ?? '—'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: K.dark },
  scroll:    { flex: 1 },
  content:   { padding: 20, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard:  { flex: 1, minWidth: '44%', backgroundColor: K.card, borderRadius: 16, padding: 16, borderWidth: 1 },
  statNum:   { fontSize: 32, fontWeight: '900' },
  statLabel: { color: K.muted, fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  section:   { color: K.teal, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 },
  empty:     { color: K.muted, fontSize: 13 },
  projRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: K.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,130,198,0.2)' },
  projIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  projName:  { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  dueCard:   { backgroundColor: K.card, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(3,161,182,0.3)', marginTop: 16 },
  dueTitle:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  dueNum:    { fontSize: 24, fontWeight: '900' },
});
