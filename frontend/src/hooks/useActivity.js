import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useTeamActivity(teamId,filters={}) {
  const [events,setEvents]=useState([]);
  const [loading,setLoading]=useState(false);
  const load=useCallback(()=>{
    if(!teamId)return;
    setLoading(true);
    api.get(`/api/activity/team/${teamId}`,{params:{limit:100,...filters}}).then(r=>setEvents(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[teamId,JSON.stringify(filters)]);
  useEffect(load,[load]);
  return{events,loading,refresh:load};
}

export function useTaskActivity(taskId) {
  const [events,setEvents]=useState([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!taskId)return;
    setLoading(true);
    api.get(`/api/activity/task/${taskId}`).then(r=>setEvents(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[taskId]);
  return{events,loading};
}
