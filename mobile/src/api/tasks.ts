import { apiClient } from './client';
import type { Task, Subtask } from './types';

export const tasksApi = {
  list:   (params?: Record<string, unknown>) =>
    apiClient.get<Task[]>('/tasks', { params }).then(r => r.data),

  get:    (taskId: string) =>
    apiClient.get<Task>(`/tasks/${taskId}`).then(r => r.data),

  create: (body: Partial<Task>) =>
    apiClient.post<Task>('/tasks', body).then(r => r.data),

  update: (taskId: string, body: Partial<Task>) =>
    apiClient.put<Task>(`/tasks/${taskId}`, body).then(r => r.data),

  move:   (taskId: string, columnId: string, order = 0) =>
    apiClient.patch<Task>(`/tasks/${taskId}/move`, { column_id: columnId, order }).then(r => r.data),

  delete: (taskId: string) =>
    apiClient.delete(`/tasks/${taskId}`).then(r => r.data),

  // Subtasks
  addSubtask:    (taskId: string, title: string) =>
    apiClient.post<Task>(`/tasks/${taskId}/subtasks`, { title }).then(r => r.data),

  toggleSubtask: (taskId: string, subtaskId: string) =>
    apiClient.patch<Task>(`/tasks/${taskId}/subtasks/${subtaskId}`).then(r => r.data),

  updateSubtask: (taskId: string, subtaskId: string, body: Partial<Subtask>) =>
    apiClient.put<Task>(`/tasks/${taskId}/subtasks/${subtaskId}`, body).then(r => r.data),

  deleteSubtask: (taskId: string, subtaskId: string) =>
    apiClient.delete<Task>(`/tasks/${taskId}/subtasks/${subtaskId}`).then(r => r.data),

  // Comments
  getComments:   (taskId: string) =>
    apiClient.get(`/tasks/${taskId}/comments`).then(r => r.data),

  addComment:    (taskId: string, body: string) =>
    apiClient.post(`/tasks/${taskId}/comments`, { body }).then(r => r.data),

  editComment:   (taskId: string, commentId: string, body: string) =>
    apiClient.put(`/tasks/${taskId}/comments/${commentId}`, { body }).then(r => r.data),

  deleteComment: (taskId: string, commentId: string) =>
    apiClient.delete(`/tasks/${taskId}/comments/${commentId}`).then(r => r.data),

  // Approvals
  requestApproval: (taskId: string, notes?: string) =>
    apiClient.post(`/tasks/${taskId}/request-approval`, { notes }).then(r => r.data),

  reviewApproval: (taskId: string, status: 'approved' | 'rejected' | 'pending_client', opts?: {
    notes?: string; send_to_client?: boolean; client_email?: string;
  }) => apiClient.post(`/approvals/task_approval::${taskId}/review`, {
    status, ...opts,
  }).then(r => r.data),

  clientApprove: (taskId: string) =>
    apiClient.post(`/tasks/${taskId}/client-approve`, { notes: '' }).then(r => r.data),

  clientReject:  (taskId: string, notes: string) =>
    apiClient.post(`/tasks/${taskId}/client-reject`, { notes }).then(r => r.data),

  // Attachments
  uploadAttachment: (taskId: string, formData: FormData) =>
    apiClient.post<Task>(`/tasks/${taskId}/attachments`, formData).then(r => r.data),

  deleteAttachment: (taskId: string, key: string) =>
    apiClient.delete(`/tasks/${taskId}/attachments/${encodeURIComponent(key)}`).then(r => r.data),
};
