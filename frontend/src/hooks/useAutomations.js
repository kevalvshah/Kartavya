import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useAutomations(teamId) {
  const [automations,setAutomations]=useState([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!teamId)return;
    setLoading(true);
    api.get(`/api/automations/team/${teamId}`).then(r=>setAutomations(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[teamId]);
  const create=useCallback(async(payload)=>{
    const res=await api.post('/api/automations/',{team_id:teamId,...payload});
    setAutomations(v=>[res.data,...v]);return res.data;
  },[teamId]);
  const toggle=useCallback(async(autoId,enabled)=>{
    await api.put(`/api/automations/${autoId}`,{enabled});
    setAutomations(v=>v.map(a=>a.automation_id===autoId?{...a,enabled}:a));
  },[]);
  const remove=useCallback(async(autoId)=>{
    await api.delete(`/api/automations/${autoId}`);
    setAutomations(v=>v.filter(a=>a.automation_id!==autoId));
  },[]);
  return{automations,loading,create,toggle,remove};
}
