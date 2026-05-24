/**
 * BoardsScreen — project list.
 * Phase 2 will add project colour swatches, member counts, and pull-to-refresh.
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { projectsApi } from '../api/projects';
import { projectColor } from '../theme/tokens';
import type { RootStackParamList } from '../nav/RootStack';
import type { Project } from '../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

export default function BoardsScreen() {
  const { t } = useTheme();
  const nav    = useNavigation<Nav>();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn:  projectsApi.list,
  });

  if (isLoading) return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <ActivityIndicator color={t.primary} size="large" />
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
        <Text style={[s.title, { color: t.ink }]}>Boards</Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(p: Project) => p.team_id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={[s.empty, { color: t.ink3 }]}>No projects yet.</Text>}
        renderItem={({ item: p }: { item: Project }) => {
          const color = projectColor(p.team_id, p.color ?? undefined);
          return (
            <TouchableOpacity
              style={[s.card, { backgroundColor: t.surface, borderColor: t.outline, borderLeftColor: color }]}
              onPress={() => nav.navigate('Board', { projectId: p.team_id, projectName: p.name })}
              activeOpacity={0.8}
            >
              <View style={[s.dot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.cardName, { color: t.ink }]}>{p.name}</Text>
                {p.description ? <Text style={[s.cardDesc, { color: t.ink3 }]} numberOfLines={1}>{p.description}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.ink3} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1 },
  header:   { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title:    { fontSize: 24, fontWeight: '900', letterSpacing: 0.3 },
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 4 },
  dot:      { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  cardName: { fontSize: 14, fontWeight: '700' },
  cardDesc: { fontSize: 12, marginTop: 2 },
  empty:    { fontSize: 13, textAlign: 'center', marginTop: 40 },
});
