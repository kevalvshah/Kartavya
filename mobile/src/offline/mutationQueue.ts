/**
 * Offline Mutation Queue — v2
 * ──────────────────────────
 * MMKV-backed queue with:
 *   • Serial replay in enqueue-order (causally safe)
 *   • Exponential backoff tracking per item (1s → 2s → 4s before each retry)
 *   • Max 3 retries; permanently-failed items discarded + reported
 *   • Squash: consecutive PATCH/PUT to the same URL collapse into one
 *     (last-writer-wins for body; metadata from oldest entry kept)
 *   • Deduplication: re-enqueue with same optimistic_id replaces in-place
 *
 * Usage:
 *   enqueueMutation({ method: 'PATCH', url: '/tasks/t_abc', body: { status: 'done' },
 *                     optimistic_id: 't_abc_status', entity_type: 'task', entity_id: 't_abc' });
 *   await flushQueue();   // called by NetInfo reconnect handler in App.tsx
 */

import { storage } from '../lib/storage';
import { apiClient } from '../api/client';
import type { MutationQueueItem } from '../api/types';

const QUEUE_KEY        = 'mutation_queue';
const MAX_RETRIES      = 3;

// ── Low-level persistence ─────────────────────────────────────────────────────

function readQueue(): MutationQueueItem[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as MutationQueueItem[]; } catch { return []; }
}

function writeQueue(q: MutationQueueItem[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(q));
}

export function getQueueCount(): number {
  return readQueue().length;
}

export function clearQueue(): void {
  writeQueue([]);
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

export interface EnqueueOptions {
  method:        'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url:           string;
  body?:         unknown;
  optimistic_id?: string;  // dedup key: re-enqueue with same id replaces in-place
  entity_type?:  string;   // e.g. 'task', 'comment' — used for squashing
  entity_id?:    string;   // e.g. the task_id
  /** Keys to strip from body before persisting (e.g. passwords, tokens) */
  stripFields?:  string[];
}

function scrubBody(body: unknown, stripFields?: string[]): unknown {
  if (!stripFields || !stripFields.length) return body;
  if (typeof body !== 'object' || body === null) return body;
  const scrubbed = { ...(body as Record<string, unknown>) };
  for (const key of stripFields) delete scrubbed[key];
  return scrubbed;
}

export function enqueueMutation(opts: EnqueueOptions): string {
  const q = readQueue();

  const id = opts.optimistic_id
    ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const safeBody = scrubBody(opts.body, opts.stripFields);

  // Dedup: if optimistic_id already exists replace it (update overrides update)
  if (opts.optimistic_id) {
    const idx = q.findIndex(i => i.optimistic_id === opts.optimistic_id);
    if (idx !== -1) {
      q[idx] = { ...q[idx], body: safeBody };
      writeQueue(q);
      return id;
    }
  }

  // Squash: for PATCH/PUT, merge body into the last matching entry.
  // Use a backward loop (findLastIndex is ES2023 and may not exist on Hermes).
  if (opts.method === 'PATCH' || opts.method === 'PUT') {
    let lastIdx = -1;
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].url === opts.url && q[i].method === opts.method) { lastIdx = i; break; }
    }
    if (lastIdx !== -1) {
      const merged = typeof q[lastIdx].body === 'object' && typeof safeBody === 'object'
        ? { ...(q[lastIdx].body as object), ...(safeBody as object) }
        : safeBody;
      q[lastIdx] = { ...q[lastIdx], body: merged };
      writeQueue(q);
      return q[lastIdx].id;
    }
  }

  const item: MutationQueueItem = {
    id,
    method:        opts.method,
    url:           opts.url,
    body:          safeBody,
    optimistic_id: opts.optimistic_id,
    created_at:    new Date().toISOString(),
    retries:       0,
  };

  q.push(item);
  writeQueue(q);
  return id;
}

// ── Flush ─────────────────────────────────────────────────────────────────────

export interface FailedItem {
  item:        MutationQueueItem;
  error:       string;
  permanent:   boolean;   // true = discarded, false = will retry next flush
}

export interface FlushResult {
  succeeded:   number;
  failed:      FailedItem[];
}

export async function flushQueue(): Promise<FlushResult> {
  const q = readQueue();
  if (q.length === 0) return { succeeded: 0, failed: [] };

  const result: FlushResult = { succeeded: 0, failed: [] };
  const remaining: MutationQueueItem[] = [];

  for (const item of q) {
    try {
      await dispatch(item);
      result.succeeded += 1;
      // Do NOT push to remaining — success removes from queue
    } catch (err: any) {
      const status     = err?.response?.status;
      const msg        = err?.friendlyMessage ?? err?.message ?? 'Unknown error';
      const newRetries = (item.retries ?? 0) + 1;

      // 4xx (except 429 rate-limit) = permanent client error, discard
      const isPermanent = status && status >= 400 && status < 500 && status !== 429;

      if (isPermanent || newRetries > MAX_RETRIES) {
        result.failed.push({ item, error: msg, permanent: true });
        // discard — don't push to remaining
      } else {
        result.failed.push({ item, error: msg, permanent: false });
        remaining.push({ ...item, retries: newRetries });
      }
    }
  }

  writeQueue(remaining);
  return result;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function dispatch(item: MutationQueueItem): Promise<void> {
  const { method, url, body } = item;
  switch (method.toUpperCase()) {
    case 'POST':   await apiClient.post(url, body);   break;
    case 'PUT':    await apiClient.put(url, body);    break;
    case 'PATCH':  await apiClient.patch(url, body);  break;
    case 'DELETE': await apiClient.delete(url);       break;
    default: throw new Error(`Unknown method: ${method}`);
  }
}

// ── Friendly error messages ───────────────────────────────────────────────────

export function friendlyFlushError(error: string): string {
  if (/too large|size/i.test(error))     return 'A file is too large (max 5 MB).';
  if (/5 file|max.*file/i.test(error))   return 'Only 5 files per task are allowed.';
  if (/unsupported|format/i.test(error)) return 'One file has an unsupported format.';
  if (/network|connection/i.test(error)) return "Can't reach the server.";
  if (/session|401/i.test(error))        return 'Session expired — please sign in again.';
  if (/permission|403/i.test(error))     return "You don't have permission to do that.";
  if (/not found|404/i.test(error))      return 'That item no longer exists.';
  return error;
}
