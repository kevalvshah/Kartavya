/**
 * NewTaskSheet — bottom-sheet modal for quick task creation.
 * Presents as a slide-up modal with title, optional due-date, and project picker.
 */
import React, { useState, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { tasksApi } from '../api/tasks';
import { apiClient } from '../api/client';
import type { Project } from '../api/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NewTaskSheet({ visible, onClose }: Props) {
  const { t } = useTheme();
  const qc    = useQueryClient();

  const [title,     setTitle]     = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn:  () => apiClient.get<Project[]>('/projects').then(r => r.data),
    enabled:  visible,
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title:   title.trim(),
        team_id: projectId ?? undefined,
        status:  'todo',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Could not create task.';
      setError(msg);
    },
  });

  const handleClose = useCallback(() => {
    setTitle('');
    setProjectId(null);
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setError(null);
    create();
  };

  const s = styles(t);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.sheetWrap}
      >
        <View style={s.sheet}>
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>New Task</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={t.ink3} />
            </TouchableOpacity>
          </View>

          {/* Title input */}
          <TextInput
            value={title}
            onChangeText={v => { setTitle(v); setError(null); }}
            placeholder="Task title…"
            placeholderTextColor={t.ink3}
            style={s.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {/* Project picker */}
          {projects.length > 0 && (
            <>
              <Text style={s.label}>PROJECT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.projectRow}>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.team_id}
                    onPress={() => setProjectId(p.team_id === projectId ? null : p.team_id)}
                    style={[s.chip, projectId === p.team_id && s.chipActive]}
                  >
                    <Text style={[s.chipText, projectId === p.team_id && s.chipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Error */}
          {error && <Text style={s.errorText}>{error}</Text>}

          {/* Submit */}
          <TouchableOpacity
            style={[s.btn, (!title.trim() || isPending) && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!title.trim() || isPending}
          >
            {isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>Add Task</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: ReturnType<typeof useTheme>['t']) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: t.outline,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: t.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: t.outline,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: t.ink,
    backgroundColor: t.bg,
    marginBottom: 16,
  },
  label: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    color: t.ink3, marginBottom: 8,
  },
  projectRow: {
    flexDirection: 'row', marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: t.outline,
    marginRight: 8, backgroundColor: t.bg,
  },
  chipActive: {
    borderColor: t.primary,
    backgroundColor: `${t.primary}18`,
  },
  chipText: {
    fontSize: 13, color: t.ink3, fontWeight: '600',
  },
  chipTextActive: {
    color: t.primary,
  },
  errorText: {
    fontSize: 13, color: '#dc2626', marginBottom: 12,
  },
  btn: {
    backgroundColor: t.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#fff', fontWeight: '700', fontSize: 15,
  },
});
