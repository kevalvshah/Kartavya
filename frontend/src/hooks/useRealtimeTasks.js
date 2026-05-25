/**
 * useRealtimeTasks.js
 *
 * Subscribes to Supabase Realtime changes on the `tasks` table
 * filtered to a specific project. When any INSERT / UPDATE / DELETE
 * arrives it patches local state immediately — no full re-fetch needed.
 *
 * Usage:
 *   const { tasks, setTasks } = useRealtimeTasks(projectId, initialTasks);
 *
 * The hook owns task state so that remote patches land atomically
 * alongside local optimistic updates.
 *
 * Prerequisites (run once in Supabase SQL editor):
 *   ALTER TABLE tasks REPLICA IDENTITY FULL;
 *   -- Then in Supabase Dashboard: Database > Replication > tasks > toggle ON
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/utils';

export function useRealtimeTasks(projectId, initialTasks = []) {
  const [tasks, setTasks] = useState(initialTasks);
  const channelRef = useRef(null);

  // Keep tasks in sync when parent re-loads (e.g. initial fetch completes)
  // without nuking in-flight realtime patches.
  const taskIds = initialTasks.map(t => t.task_id).join(',');
  useEffect(() => {
    setTasks(initialTasks);
  }, [taskIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabase || !projectId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `realtime:tasks:project:${projectId}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT | UPDATE | DELETE
          schema: 'public',
          table: 'tasks',
          filter: `team_id=eq.${projectId}`,  // Kartavya uses team_id as project FK
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          setTasks((prev) => {
            switch (eventType) {
              case 'INSERT':
                // Avoid duplicates if the local optimistic update already added it
                if (prev.some(t => t.task_id === newRow.task_id)) return prev;
                return [newRow, ...prev];

              case 'UPDATE':
                return prev.map(t =>
                  t.task_id === newRow.task_id ? { ...t, ...newRow } : t
                );

              case 'DELETE':
                return prev.filter(t => t.task_id !== oldRow.task_id);

              default:
                return prev;
            }
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug(`[Realtime] subscribed to tasks for project ${projectId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          logger.warn(`[Realtime] channel error for project ${projectId}`);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId]);

  return { tasks, setTasks };
}
