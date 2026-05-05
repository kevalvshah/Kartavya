/**
 * useFields — fetch field definitions + values for a task/team, handle saves.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useFieldDefs(teamId) {
  const [defs, setDefs]     = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    api.get(`/api/fields/team/${teamId}`)
       .then(r => setDefs(r.data))
       .catch(console.error)
       .finally(() => setLoading(false));
  }, [teamId]);

  const createField = useCallback(async (payload) => {
    const res = await api.post('/api/fields/', { team_id: teamId, ...payload });
    setDefs(prev => [...prev, res.data]);
    return res.data;
  }, [teamId]);

  const updateField = useCallback(async (fieldId, patch) => {
    await api.put(`/api/fields/${fieldId}`, patch);
    setDefs(prev => prev.map(f => f.field_id === fieldId ? { ...f, ...patch } : f));
  }, []);

  const deleteField = useCallback(async (fieldId) => {
    await api.delete(`/api/fields/${fieldId}`);
    setDefs(prev => prev.filter(f => f.field_id !== fieldId));
  }, []);

  return { defs, loading, createField, updateField, deleteField };
}

export function useFieldValues(taskId) {
  const [values, setValues]   = useState({});  // { field_id: value }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    api.get(`/api/fields/task/${taskId}/values`)
       .then(r => {
         const vals = {};
         r.data.forEach(v => { vals[v.field_id] = v.value; });
         setValues(vals);
       })
       .catch(console.error)
       .finally(() => setLoading(false));
  }, [taskId]);

  const setValue = useCallback(async (fieldId, value) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    try {
      await api.put(`/api/fields/task/${taskId}/values`, [{ field_id: fieldId, value }]);
    } catch (e) {
      console.error('Field value save failed', e);
    }
  }, [taskId]);

  return { values, loading, setValue };
}
