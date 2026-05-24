import { apiClient } from './client';
import type { Project, ProjectColumn, TeamMember } from './types';

export const projectsApi = {
  list:    () =>
    apiClient.get<Project[]>('/teams').then(r => r.data),

  get:     (teamId: string) =>
    apiClient.get(`/teams/${teamId}`).then(r => r.data),

  setColor: (teamId: string, color: string) =>
    apiClient.patch(`/teams/${teamId}/color`, { color }).then(r => r.data),

  columns: (teamId: string) =>
    apiClient.get<ProjectColumn[]>(`/projects/${teamId}/columns`).then(r => r.data),

  members: (teamId: string) =>
    apiClient.get<{ members: TeamMember[] }>(`/teams/${teamId}`)
      .then(r => Array.isArray(r.data?.members) ? r.data.members : []),
};
