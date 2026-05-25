/**
 * useFields â€” fetch field definitions + values for a task/team, handle saves.
 */
import { logger } from '../lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useFieldDefs(teamId) {
  const [defs, setDefs]       = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    api.get(`/fields/team/${teamId}`)
       .then(r => setDefs(r.data))
       .catch(logger.error)
       .finally(() => setLoading(false));
  }, [teamId]);

  const createField = useCallback(async (payload) => {
    const res = await api.post('/fields/', { team_id: teamId, ...payload });
    setDefs(prev => [...prev, res.data]);
    return res.data;
  }, [teamId]);

  const updateField = useCallback(async (fieldId, patch) => {
    await api.put(`/fields/${fieldId}`, patch);
    setDefs(prev => prev.map(f => f.field_id === fieldId ? { ...f, ...patch } : f));
  }, []);

  const deleteField = useCallback(async (fieldId) => {
    await api.delete(`/fields/${fieldId}`);
    setDefs(prev => prev.filter(f => f.field_id !== fieldId));
  }, []);

  return { defs, loading, createField, updateField, deleteField };
}

export function useFieldValues(taskId) {
  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    api.get(`/fields/task/${taskId}/values`)
       .then(r => {
         const vals = {};
         r.data.forEach(v => { vals[v.field_id] = v.value; });
         setValues(vals);
       })
       .catch(logger.error)
       .finally(() => setLoading(false));
  }, [taskId]);

  const setValue = useCallback(async (fieldId, value) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    try {
      await api.put(`/fields/task/${taskId}/values`, [{ field_id: fieldId, value }]);
    } catch (e) {
      logger.error('Field value save failed', e);
    }
  }, [taskId]);

  return { values, loading, setValue };
}

/**
 * Combined convenience hook â€” some components import { useFields }.
 * Returns { defs, fieldValues, loading, createField, updateField, deleteField, setValue }.
 */
export function useFields(teamId, taskId) {
  const fieldDefs   = useFieldDefs(teamId);
  const fieldValues = useFieldValues(taskId);
  return { ...fieldDefs, fieldValues: fieldValues.values, setValue: fieldValues.setValue };
}

