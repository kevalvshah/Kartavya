import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { PRIORITY_COLOR } from '../theme/tokens';
import { a11yButton } from './a11y';
import type { Task } from '../api/types';

export interface TaskCardProps {
  task:         Task;
  onPress:      () => void;
  showProject?: boolean;
  syncing?:     boolean;
}

const PRIO_LABEL: Record<string, string> = {
  urgent: 'urgent', high: 'high', medium: 'medium', low: 'low',
};

function dueDateLabel(due: string): { label: string; danger: boolean; warn: boolean } {
  const d = new Date(due);
  if (isPast(d) && !isToday(d)) return { label: format(d, 'd MMM'), danger: true,  warn: false };
  if (isToday(d))               return { label: 'Today',             danger: false, warn: true  };
  if (isTomorrow(d))            return { label: 'Tomorrow',          danger: false, warn: false };
  return { label: format(d, 'd MMM'), danger: false, warn: false };
}

function TaskCardInner({ task, onPress, showProject = false, syncing = false }: TaskCardProps) {
  const { t } = useTheme();
  const priColor = PRIORITY_COLOR[task.priority] ?? '#636366';
  const done     = (task.subtasks ?? []).filter(s => s.is_done).length;
  const total    = (task.subtasks ?? []).length;
  const due      = task.due_at ? dueDateLabel(task.due_at) : null;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: t.surface }]}
      onPress={onPress}
      activeOpacity={0.75}
      {...a11yButton(task.title, 'Opens task detail')}
    >
      {/* Top row: project + task ID + sync indicator */}
      <View style={s.topRow}>
        {showProject && task.team_name ? (
          <View style={s.projectRow}>
            <View style={[s.projDot, { backgroundColor: priColor }]} />
            <Text style={[s.projectLabel, { color: t.ink3 }]} numberOfLines={1}>{task.team_name}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {syncing && <Ionicons name="sync-outline" size={11} color="#f59e0b" />}
      </View>

      {/* Title */}
      <Text style={[s.title, { color: t.ink }]} numberOfLines={2}>{task.title}</Text>

      {/* Subtask progress */}
      {total > 0 && (
        <View style={s.progressRow}>
          <View style={[s.progressTrack, { backgroundColor: t.outline }]}>
            <View style={[s.progressBar, {
              width: `${(done / total) * 100}%` as any,
              backgroundColor: done === total ? '#05b7aa' : '#0082c6',
            }]} />
          </View>
          <Text style={[s.progressText, { color: t.ink3 }]}>{done}/{total}</Text>
        </View>
      )}

      {/* Footer chips */}
      <View style={s.footer}>
        {due && (
          <View style={[s.chip, {
            backgroundColor: due.danger ? 'rgba(239,68,68,0.12)' : due.warn ? 'rgba(245,158,11,0.14)' : t.surfaceLow ?? t.bg,
          }]}>
            <Ionicons name="calendar-outline" size={10}
              color={due.danger ? '#ef4444' : due.warn ? '#f59e0b' : t.ink3} />
            <Text style={[s.chipText, {
              color: due.danger ? '#ef4444' : due.warn ? '#f59e0b' : t.ink3,
            }]}>{due.label}</Text>
          </View>
        )}

        <View style={[s.chip, { backgroundColor: priColor + '18' }]}>
          <Text style={[s.chipText, { color: priColor }]}>{PRIO_LABEL[task.priority] ?? task.priority}</Text>
        </View>

        {task.approval_status && task.approval_status !== 'approved' && (
          <View style={[s.chip, { backgroundColor: 'rgba(255,159,10,0.14)' }]}>
            <Text style={[s.chipText, { color: '#B06A00' }]}>APPROVAL</Text>
          </View>
        )}

        {task.status && (
          <View style={[s.chip, { backgroundColor: t.outline + '88' }]}>
            <Text style={[s.chipText, { color: t.ink3 }]}>{task.status.replace(/_/g, ' ')}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={13} color={t.ink4} />
      </View>
    </TouchableOpacity>
  );
}

function areEqual(prev: TaskCardProps, next: TaskCardProps): boolean {
  const p = prev.task; const n = next.task;
  return (
    p.task_id          === n.task_id          &&
    p.title            === n.title            &&
    p.status           === n.status           &&
    p.priority         === n.priority         &&
    p.due_at           === n.due_at           &&
    p.approval_status  === n.approval_status  &&
    p.subtasks?.length === n.subtasks?.length &&
    (p.subtasks ?? []).filter(s => s.is_done).length ===
    (n.subtasks ?? []).filter(s => s.is_done).length &&
    prev.showProject   === next.showProject   &&
    prev.syncing       === next.syncing
  );
}

export const TaskCard = React.memo(TaskCardInner, areEqual);

const s = StyleSheet.create({
  card: {
    borderRadius:   16,
    padding:        14,
    marginBottom:   8,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.06,
    shadowRadius:   4,
    elevation:      2,
    gap:            6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    minHeight:     16,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  projDot: {
    width:        7,
    height:       7,
    borderRadius: 2,
  },
  projectLabel: {
    fontSize:      11,
    fontWeight:    '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize:   15,
    fontWeight: '600',
    lineHeight: 21,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  progressTrack: {
    flex:         1,
    height:       3,
    borderRadius: 2,
    overflow:     'hidden',
  },
  progressBar: {
    height:       3,
    borderRadius: 2,
  },
  progressText: {
    fontSize:  10,
    fontWeight:'600',
    minWidth:  28,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           5,
    marginTop:     2,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      6,
  },
  chipText: {
    fontSize:   10,
    fontWeight: '700',
  },
});
