import { apiClient } from './client';
import type { TaskTemplate } from './types';

export const templatesApi = {
  list: (teamId?: string): Promise<TaskTemplate[]> =>
    apiClient.get('/templates/tasks', {
      params: teamId ? { team_id: teamId } : {},
    }).then(r => (Array.isArray(r.data) ? r.data : [])),
};
