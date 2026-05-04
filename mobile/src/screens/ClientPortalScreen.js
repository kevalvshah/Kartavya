import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, apiLogout, getUser } from '../api';
import { K } from '../theme';

export default function ClientPortalScreen({ onLogout }) {
  const [tasks, setTasks]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment]   = useState('');
  const [user, setUser]         = useState(null);

  useEffect(() => {
    getUser().then(setUser);
    api.get('/client/tasks').then((r) => setTasks(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/tasks/${selected.task_id}/comments`).then((r) => setComments(r.data)).catch(() => {});
  }, [selected]);

  const postComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.post(`/tasks/${selected.task_id}/comments`, { body: comment.trim() });
      setComment('');
      api.get(`/tasks/${selected.task_id}/comments`).then((r) => setComments(r.data));
    } catch (_) { Alert.alert('Error', 'Could not post comment'); }
  };

  const confirmLogout = () => Alert.alert('Sign out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await apiLogout(); onLogout?.(); } },
  ]);

  if (selected) return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSelected(null)} style={s.back}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.taskTitle} numberOfLines={2}>{selected.title}</Text>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.comment_id}
        contentContainerStyle={s.commentList}
        ListEmptyComponent={<Text style={s.empty}>No comments yet. Be the first.</Text>}
        renderItem={({ item: c }) => (
          <View style={s.comment}>
            <LinearGradient colors={K.gradD} style={s.commAvatar}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{(c.user_name || '?')[0].toUpperCase()}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.commName}>{c.user_name} · {new Date(c.created_at).toLocaleString()}</Text>
              <Text style={s.commBody}>{c.body}</Text>
            </View>
          </View>
        )}
      />
      <View style={s.inputRow}>
        <TextInput style={s.input} value={comment} onChangeText={setComment}
          placeholder="Add a comment…" placeholderTextColor={K.muted} multiline />
        <TouchableOpacity onPress={postComment}>
          <LinearGradient colors={K.gradD} style={s.sendBtn}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Post</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <LinearGradient colors={K.gradD} style={s.logo}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>◆</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>KARTAVYA</Text>
          <Text style={s.brandSub}>Hi, {user?.name}</Text>
        </View>
        <TouchableOpacity onPress={confirmLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.sectionLabel}>Your Updates</Text>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.task_id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No tasks shared with you yet.</Text>}
        renderItem={({ item: t }) => (
          <TouchableOpacity style={s.taskCard} onPress={() => setSelected(t)}>
            <View style={s.taskTop}>
              <Text style={s.taskTitleText} numberOfLines={2}>{t.title}</Text>
              <View style={[s.status, { backgroundColor: 'rgba(5,183,170,0.15)' }]}>
                <Text style={[s.statusText, { color: K.teal }]}>{t.status === 'in_progress' ? 'In Progress' : t.status}</Text>
              </View>
            </View>
            {t.description && <Text style={s.desc} numberOfLines={2}>{t.description}</Text>}
            {t.due_at && <Text style={s.due}>Due {new Date(t.due_at).toLocaleDateString()}</Text>}
            <Text style={s.tapHint}>Tap to comment ›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: K.dark },
  header:       { backgroundColor: K.card, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,130,198,0.2)' },
  logo:         { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brand:        { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  brandSub:     { color: K.muted, fontSize: 11, marginTop: 1 },
  logoutBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)' },
  logoutText:   { color: K.danger, fontSize: 11, fontWeight: '700' },
  sectionLabel: { color: K.teal, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', padding: 16, paddingBottom: 8 },
  list:         { padding: 16, paddingBottom: 40 },
  empty:        { color: K.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  taskCard:     { backgroundColor: K.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.25)' },
  taskTop:      { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' },
  taskTitleText:{ color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  status:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText:   { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  desc:         { color: K.muted, fontSize: 12, marginTop: 8, lineHeight: 17 },
  due:          { color: K.mid, fontSize: 10, marginTop: 6, fontWeight: '600' },
  tapHint:      { color: K.blue, fontSize: 10, marginTop: 10, fontWeight: '700' },
  back:         { marginRight: 8 },
  backText:     { color: K.blue, fontSize: 18, fontWeight: '700' },
  taskTitle:    { color: '#fff', fontSize: 16, fontWeight: '900', flex: 1 },
  commentList:  { padding: 16, paddingBottom: 20 },
  comment:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commAvatar:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commName:     { color: K.muted, fontSize: 10, marginBottom: 4 },
  commBody:     { color: '#e6eeff', fontSize: 13, lineHeight: 19 },
  inputRow:     { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,130,198,0.2)', backgroundColor: K.card },
  input:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.25)', padding: 10, color: '#fff', maxHeight: 80 },
  sendBtn:      { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
});
