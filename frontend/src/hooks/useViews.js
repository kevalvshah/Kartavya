import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useViews(teamId) {
  const [views,setViews]=useState([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!teamId)return;
    setLoading(true);
    api.get(`/api/views/team/${teamId}`).then(r=>setViews(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[teamId]);
  const saveView=useCallback(async(name,type,config={},isDefault=false)=>{
    const res=await api.post('/api/views/',{team_id:teamId,name,type,config,is_default:isDefault});
    setViews(v=>[...v,res.data]);return res.data;
  },[teamId]);
  const updateView=useCallback(async(viewId,patch)=>{
    await api.put(`/api/views/${viewId}`,patch);
    setViews(v=>v.map(x=>x.view_id===viewId?{...x,...patch}:x));
  },[]);
  const deleteView=useCallback(async(viewId)=>{
    await api.delete(`/api/views/${viewId}`);
    setViews(v=>v.filter(x=>x.view_id!==viewId));
  },[]);
  return{views,loading,saveView,updateView,deleteView};
}
