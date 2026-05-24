/**
 * useOfflineMutation
 * ──────────────────
 * Drop-in wrapper around TanStack Query's `useMutation` that falls back to
 * the MMKV offline queue when the device has no internet.
 *
 * Guarantees:
 *   1. When online  → normal mutation (server response, cache invalidation)
 *   2. When offline → enqueueMutation + optimistic cache update
 *   3. On reconnect → App.tsx flushQueue() replays in order
 *
 * Usage:
 *   const { mutate, isQueued } = useOfflineMutation({
 *     method:      'PATCH',
 *     urlBuilder:  (vars) => `/tasks/${vars.taskId}`,
 *     mutationFn:  (vars) => tasksApi.update(vars.taskId, vars.patch),
 *     onlineOptions: {
 *       onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
 *     },
 *     optimisticUpdate: (vars, qc) => {
 *       qc.setQueryData(['task', vars.taskId], (old) => old ? { ...old, ...vars.patch } : old);
 *     },
 *     rollback: (vars, snapshot, qc) => {
 *       if (snapshot) qc.setQueryData(['task', vars.taskId], snapshot);
 *     },
 *     snapshotKey: (vars) => ['task', vars.taskId],
 *     optimisticId: (vars) => `task_${vars.taskId}_status`,
 *   });
 */

import { useMutation, useQueryClient, type UseMutationOptions, type QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { enqueueMutation, type EnqueueOptions } from '../offline/mutationQueue';

// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineMutationOptions<TVariables, TData = unknown, TSnapshot = unknown> {
  /** HTTP method for the queue */
  method:       EnqueueOptions['method'];
  /** Build the URL from variables (used when queueing offline) */
  urlBuilder:   (vars: TVariables) => string;
  /** The actual async mutation function (online path) */
  mutationFn:   (vars: TVariables) => Promise<TData>;
  /** Optional TanStack mutation options (onSuccess, onError, etc.) for the online path */
  onlineOptions?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>;
  /**
   * Apply optimistic update to the cache immediately (both online + offline).
   * Called before the request fires. Return value is ignored.
   */
  optimisticUpdate?: (vars: TVariables, qc: QueryClient) => void;
  /**
   * Roll back the optimistic update when an online mutation fails.
   * Snapshot (captured before optimisticUpdate) is passed in.
   */
  rollback?: (vars: TVariables, snapshot: TSnapshot | undefined, qc: QueryClient) => void;
  /**
   * Query key to snapshot before optimistic update (for rollback).
   * Only used on the online path.
   */
  snapshotKey?: (vars: TVariables) => readonly unknown[];
  /**
   * Build a stable dedup key for the queue (prevents duplicate enqueues).
   * Example: (vars) => `task_${vars.taskId}_patch`
   */
  optimisticId?: (vars: TVariables) => string;
  /** Body builder for offline queue (defaults to vars) */
  bodyBuilder?: (vars: TVariables) => unknown;
  /** Entity type for squash logic */
  entity_type?: string;
  /** Entity id for squash logic */
  entityId?: (vars: TVariables) => string;
}

export interface OfflineMutationResult<TVariables> {
  mutate:      (vars: TVariables) => void;
  mutateAsync: (vars: TVariables) => Promise<void>;
  isQueued:    boolean;       // true if last call was enqueued offline
  isPending:   boolean;
  isError:     boolean;
  error:       Error | null;
  reset:       () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useOfflineMutation<TVariables, TData = unknown, TSnapshot = unknown>(
  opts: OfflineMutationOptions<TVariables, TData, TSnapshot>
): OfflineMutationResult<TVariables> {
  const qc = useQueryClient();

  // We use a ref-like state via a regular variable that lives in closure.
  // React state isn't needed here because isQueued is an ephemeral signal.
  let _isQueued = false;

  const mutation = useMutation<TData, Error, TVariables, TSnapshot>({
    mutationFn: opts.mutationFn,
    onMutate: async (vars) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      if (opts.snapshotKey) {
        const key = opts.snapshotKey(vars);
        await qc.cancelQueries({ queryKey: key });
        const snapshot = qc.getQueryData<TSnapshot>(key);
        opts.optimisticUpdate?.(vars, qc);
        return snapshot;
      }
      opts.optimisticUpdate?.(vars, qc);
      return undefined as unknown as TSnapshot;
    },
    onError: (err, vars, snapshot) => {
      opts.rollback?.(vars, snapshot, qc);
      opts.onlineOptions?.onError?.(err, vars, snapshot);
    },
    onSuccess: (data, vars, ctx) => {
      opts.onlineOptions?.onSuccess?.(data, vars, ctx);
    },
    onSettled: (data, err, vars, ctx) => {
      opts.onlineOptions?.onSettled?.(data, err as Error | null, vars, ctx);
    },
    ...opts.onlineOptions,
  });

  const mutateAsync = async (vars: TVariables): Promise<void> => {
    const state = await NetInfo.fetch();
    const online = !!(state.isConnected && state.isInternetReachable !== false);

    if (!online) {
      // Apply optimistic update immediately even in offline path
      opts.optimisticUpdate?.(vars, qc);

      // Enqueue for later replay
      enqueueMutation({
        method:        opts.method,
        url:           opts.urlBuilder(vars),
        body:          opts.bodyBuilder ? opts.bodyBuilder(vars) : (vars as unknown),
        optimistic_id: opts.optimisticId?.(vars),
        entity_type:   opts.entity_type,
        entity_id:     opts.entityId?.(vars),
      });

      _isQueued = true;
      return;
    }

    _isQueued = false;
    await mutation.mutateAsync(vars);
  };

  const mutate = (vars: TVariables): void => {
    mutateAsync(vars).catch(() => {/* errors surfaced via mutation.error */});
  };

  return {
    mutate,
    mutateAsync,
    get isQueued()  { return _isQueued; },
    get isPending() { return mutation.isPending; },
    get isError()   { return mutation.isError; },
    get error()     { return mutation.error; },
    reset:          mutation.reset,
  };
}
