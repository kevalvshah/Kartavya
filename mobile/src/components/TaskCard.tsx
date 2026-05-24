/**
 * TaskCard — shared, memoized task card.
 * Used by TodayScreen (SectionList), BoardScreen (column FlatList), and any
 * future list views.
 *
 * Perf notes:
 *   • Wrapped in React.memo with a custom comparator — only re-renders when
 *     the fields actually visible in the card change.
 *   • All derived values are computed inline (no hooks needed — fast path).
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isPast } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { PRIORITY_COLOR } from '../theme/tokens';
import { a11yButton } from './a11y';
import type { Task } from '../api/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TaskCardProps {
  task:    Task;
  onPress: () => void;
  /** Show project/team name below title (useful in Today view) */
  showProject?: boolean;
  /** True when an offline mutation for this task is pending in the queue */
  syncing?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

function TaskCardInner({ task, onPress, showProject = false, syncing = false }: TaskCardProps) {
  const { t } = useTheme();

  const priColor = PRIORITY_COLOR[task.priority] ?? '#636366';
  const done     = (task.subtasks ?? []).filter(s => s.is_done).length;
  const total    = (task.subtasks ?? []).length;
  const pct      = total > 0 ? done / total : 0;
  const dueStr   = task.due_at ? format(new Date(task.due_at), 'd MMM') : null;
  const isLate   = task.due_at
    ? isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at))
    : false;

  const statusLabel = task.status?.replace(/_/g, ' ') ?? '';
  const a11yLabel   = [
    task.title,
    task.priority ? `${task.priority} priority` : null,
    dueStr         ? `due ${dueStr}`             : null,
    isLate         ? 'overdue'                   : null,
    total > 0      ? `${done} of ${total} subtasks done` : null,
  ].filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: t.surface, borderColor: t.outline }]}
      onPress={onPress}
      activeOpacity={0.75}
      {...a11yButton(a11yLabel, 'Opens task detail')}
    >
      {/* Priority stripe */}
      <View style={[s.stripe, { backgroundColor: priColor }]} />

      <View style={s.body}>
        {showProject && task.team_name ? (
          <Text style={[s.project, { color: t.ink4 }]} numberOfLines={1}>
            {task.team_name}
          </Text>
        ) : null}

        <Text style={[s.title, { color: t.ink }]} numberOfLines={2}>
          {task.title}
        </Text>

        {/* Meta chips */}
        <View style={s.meta}>
          {dueStr && (
            <View style={[s.chip, {
              backgroundColor: isLate ? '#ef444422' : t.surfaceLow,
              borderColor:     isLate ? '#ef4444'   : t.outline,
            }]}>
              <Ionicons
                name="calendar-outline"
                size={10}
                color={isLate ? '#ef4444' : t.ink3}
              />
              <Text style={[s.chipText, { color: isLate ? '#ef4444' : t.ink3 }]}>
                {dueStr}
              </Text>
            </View>
          )}

          <View style={[s.chip, {
            backgroundColor: priColor + '22',
            borderColor:     priColor + '66',
          }]}>
            <Text style={[s.chipText, { color: priColor }]}>
              {task.priority}
            </Text>
          </View>

          {statusLabel ? (
            <View style={[s.chip, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}>
              <Text style={[s.chipText, { color: t.ink3 }]}>{statusLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Subtask progress bar */}
        {total > 0 && (
          <View style={s.progress} accessibilityLabel={`${done} of ${total} subtasks complete`}>
            <View style={[s.track, { backgroundColor: t.outline }]}>
              <View style={[
                s.bar,
                { width: `${pct * 100}%` as any, backgroundColor: pct === 1 ? '#22c55e' : '#0082c6' },
              ]} />
            </View>
            <Text style={[s.progressText, { color: t.ink3 }]}>{done}/{total}</Text>
          </View>
        )}
      </View>

      <View style={{ alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 2 }}>
        {syncing && (
          <Ionicons
            name="sync-outline"
            size={12}
            color="#0082c6"
            accessibilityLabel="Syncing"
          />
        )}
        <Ionicons
          name="chevron-forward"
          size={14}
          color={t.ink4}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </TouchableOpacity>
  );
}

// Custom comparator — only re-render when visible fields change
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
    prev.showProject   === next.showProject    &&
    prev.syncing       === next.syncing
  );
}

export const TaskCard = React.memo(TaskCardInner, areEqual);

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    borderRadius:   10,
    borderWidth:    1,
    marginBottom:   8,
    overflow:       'hidden',
  },
  stripe: {
    width:  3,
    alignSelf: 'stretch',
  },
  body: {
    flex:            1,
    paddingVertical: 10,
    paddingLeft:     10,
    paddingRight:    4,
    gap:             4,
  },
  project: {
    fontSize:   10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize:   14,
    fontWeight: '600',
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    marginTop:     2,
  },
  chip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            3,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:   4,
    borderWidth:    1,
  },
  chipText: {
    fontSize:   10,
    fontWeight: '600',
  },
  progress: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     4,
  },
  track: {
    flex:         1,
    height:       3,
    borderRadius: 2,
    overflow:     'hidden',
  },
  bar: {
    height:       3,
    borderRadius: 2,
  },
  progressText: {
    fontSize:   10,
    fontWeight: '600',
    minWidth:   28,
    textAlign:  'right',
  },
});
