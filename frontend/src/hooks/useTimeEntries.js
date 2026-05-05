import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export function useTimeEntries(taskId) {
  const [entries,setEntries]=useState([]);
  const [totalMinutes,setTotalMinutes]=useState(0);
  const [running,setRunning]=useState(null);
  const [loading,setLoading]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const timerRef=useRef(null);

  const load=useCallback(()=>{
    if(!taskId)return;
    setLoading(true);
    api.get(`/api/time/task/${taskId}`).then(r=>{setEntries(r.data.entries);setTotalMinutes(r.data.total_minutes);}).catch(console.error).finally(()=>setLoading(false));
  },[taskId]);
  useEffect(load,[load]);

  useEffect(()=>{
    if(!running){clearInterval(timerRef.current);setElapsed(0);return;}
    const start=new Date(running.started_at).getTime();
    timerRef.current=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);
    return()=>clearInterval(timerRef.current);
  },[running]);

  const startTimer=useCallback(async()=>{
    const res=await api.post(`/api/time/start?task_id=${taskId}`);
    setRunning(res.data);
  },[taskId]);
  const stopTimer=useCallback(async()=>{
    await api.post('/api/time/stop');setRunning(null);load();
  },[load]);
  const addManual=useCallback(async(payload)=>{
    await api.post('/api/time/manual',{task_id:taskId,...payload});load();
  },[taskId,load]);
  const deleteEntry=useCallback(async(entryId)=>{
    await api.delete(`/api/time/${entryId}`);load();
  },[load]);
  const fmtElapsed=()=>{
    const h=Math.floor(elapsed/3600),m=Math.floor((elapsed%3600)/60),s=elapsed%60;
    return[h>0?h:null,m,s].filter(x=>x!==null).map(x=>String(x).padStart(2,'0')).join(':');
  };
  return{entries,totalMinutes,running,loading,elapsed,fmtElapsed,startTimer,stopTimer,addManual,deleteEntry};
}
