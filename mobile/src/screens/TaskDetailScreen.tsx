/**
 * TaskDetailScreen
 * ────────────────
 * Full task detail: meta editing, subtasks, assignees, comments,
 * attachments, approval workflow.
 */
import React, {
  useState, useCallback, useRef, useMemo, useEffect,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform, Linking, Pressable,
  ActionSheetIOS, Keyboard,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { a11yButton, a11yToggle } from '../components/a11y';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { format, isToday, isPast } from 'date-fns';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { tasksApi } from '../api/tasks';
import { projectsApi } from '../api/projects';
import {
  PRIORITY_COLOR, APPROVAL_COLOR,
  avatarColor, userInitials,
} from '../theme/tokens';
import type {
  Task, Subtask, Comment, TeamMember,
  Priority, ApprovalStatus,
} from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Route = RouteProp<RootStackParamList, 'TaskDetail'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;

// ── helpers ───────────────────────────────────────────────────────────────────
function memberName(m: TeamMember): string {
  return m.display_name ?? m.full_name ?? m.name ?? m.email;
}
function memberId(m: TeamMember): string {
  return (m.user_id ?? m.member_id) ?? '';
}
function userName(u: { name?: string; full_name?: string; email?: string }): string {
  return u.name ?? u.full_name ?? u.email ?? '?';
}

// ── Avatar chip ───────────────────────────────────────────────────────────────
function Avatar({ uid, name, size = 28 }: { uid: string; name: string; size?: number }) {
  const bg = avatarColor(uid);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>{userInitials(name)}</Text>
    </View>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
const PRI_ICONS: Record<Priority, string> = {
  urgent: 'flame',
  high:   'arrow-up-circle',
  medium: 'remove-circle-outline',
  low:    'arrow-down-circle-outline',
};

// ── Approval banner ───────────────────────────────────────────────────────────
function ApprovalBanner({
  task, userRole, userId, onAction,
}: {
  task: Task;
  userRole: string;
  userId:   string;
  onAction: (action: 'request' | 'approve' | 'reject' | 'client') => void;
}) {
  const { t } = useTheme();
  const status = task.approval_status;
  const canReview = userRole === 'admin' || userRole === 'owner';

  if (!status) {
    if (task.user_id === userId || task.assignee_user_ids?.includes(userId) || canReview) {
      return (
        <TouchableOpacity onPress={() => onAction('request')} style={[s.approvalRow, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}
          {...a11yButton('Request approval')}>
          <Ionicons name="shield-checkmark-outline" size={16} color={t.ink3} accessibilityElementsHidden />
          <Text style={[s.approvalLabel, { color: t.ink3 }]}>Request approval</Text>
          <Ionicons name="chevron-forward" size={14} color={t.ink3} accessibilityElementsHidden />
        </TouchableOpacity>
      );
    }
    return null;
  }

  const color = APPROVAL_COLOR[status] ?? '#636366';
  const labels: Record<NonNullable<ApprovalStatus>, string> = {
    pending:        'Awaiting internal review',
    pending_client: 'Awaiting client approval',
    approved:       'Approved',
    rejected:       'Rejected',
  };

  return (
    <View style={[s.approvalBanner, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <View style={s.approvalBannerRow}>
        <Ionicons name="shield-checkmark" size={16} color={color} />
        <Text style={[s.approvalBannerLabel, { color }]}>{labels[status]}</Text>
      </View>
      {task.approval_notes ? (
        <Text style={[s.approvalNotes, { color: t.ink3 }]}>{task.approval_notes}</Text>
      ) : null}
      {status === 'pending' && canReview && (
        <View style={s.approvalActions}>
          <TouchableOpacity onPress={() => onAction('approve')} style={[s.approvalBtn, { backgroundColor: '#16a34a22', borderColor: '#16a34a' }]}
            {...a11yButton('Approve task')}>
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" accessibilityElementsHidden />
            <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700' }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onAction('reject')} style={[s.approvalBtn, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}
            {...a11yButton('Reject task')}>
            <Ionicons name="close-circle" size={14} color="#ef4444" accessibilityElementsHidden />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onAction('client')} style={[s.approvalBtn, { backgroundColor: '#7c3aed22', borderColor: '#7c3aed' }]}
            {...a11yButton('Send to client for approval')}>
            <Ionicons name="send" size={13} color="#7c3aed" accessibilityElementsHidden />
            <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '700' }}>Send to client</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Approval modal ────────────────────────────────────────────────────────────
function ApprovalModal({
  visible, action, onClose, onConfirm,
}: {
  visible:   boolean;
  action:    'request' | 'approve' | 'reject' | 'client' | null;
  onClose:   () => void;
  onConfirm: (notes: string, extra?: { client_email?: string }) => void;
}) {
  const { t } = useTheme();
  const [notes, setNotes]   = useState('');
  const [email, setEmail]   = useState('');

  const title = action === 'request' ? 'Request Approval'
    : action === 'approve'           ? 'Approve Task'
    : action === 'reject'            ? 'Reject Task'
    : action === 'client'            ? 'Send to Client'
    : '';

  const btnColor = action === 'reject' ? '#ef4444' : '#16a34a';
  const GRAD: [string, string] = action === 'reject'
    ? ['#ef4444', '#dc2626']
    : ['#0082c6', '#05b7aa'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={s.modalOverlay} onPress={onClose}>
          <Pressable style={[s.approvalModal, { backgroundColor: t.surface }]} onPress={() => {}}>
            <Text style={[s.approvalModalTitle, { color: t.ink }]}>{title}</Text>
            <Text style={[s.approvalModalLabel, { color: t.ink3 }]}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[s.approvalModalInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes…"
              placeholderTextColor={t.ink3}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {action === 'client' && (
              <>
                <Text style={[s.approvalModalLabel, { color: t.ink3, marginTop: 10 }]}>CLIENT EMAIL</Text>
                <TextInput
                  style={[s.approvalModalInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="client@example.com"
                  placeholderTextColor={t.ink3}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={onClose} style={[s.approvalModalCancelBtn, { borderColor: t.outline }]}>
                <Text style={{ color: t.ink3, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { onConfirm(notes, email ? { client_email: email } : undefined); setNotes(''); setEmail(''); }} style={{ flex: 1 }}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.approvalModalConfirmBtn}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Confirm</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Assignee picker modal ─────────────────────────────────────────────────────
function AssigneePickerModal({
  visible, members, selectedIds, onToggle, onClose,
}: {
  visible:     boolean;
  members:     TeamMember[];
  selectedIds: string[];
  onToggle:    (uid: string) => void;
  onClose:     () => void;
}) {
  const { t } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={[s.pickerSheet, { backgroundColor: t.surface }]} onPress={() => {}}>
          <View style={[s.sheetHandle, { backgroundColor: t.ink3 }]} />
          <Text style={[s.pickerTitle, { color: t.ink }]}>Assignees</Text>
          <FlatList
            data={members}
            keyExtractor={m => memberId(m)}
            style={{ maxHeight: 360 }}
            renderItem={({ item: m }) => {
              const uid      = memberId(m);
              const selected = selectedIds.includes(uid);
              const nm       = memberName(m);
              return (
                <TouchableOpacity
                  style={[s.pickerRow, { borderBottomColor: t.outline }]}
                  onPress={() => onToggle(uid)}
                >
                  <Avatar uid={uid} name={nm} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerName, { color: t.ink }]}>{nm}</Text>
                    {m.position ? <Text style={[s.pickerSub, { color: t.ink3 }]}>{m.position}</Text> : null}
                  </View>
                  {selected
                    ? <Ionicons name="checkmark-circle" size={22} color={t.primary} />
                    : <View style={[s.emptyCheck, { borderColor: t.outline }]} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity onPress={onClose} style={[s.pickerDoneBtn, { backgroundColor: t.primaryContainer }]}>
            <Text style={[s.pickerDoneText, { color: t.primary }]}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Move column modal ─────────────────────────────────────────────────────────
function MoveModal({
  visible, columns, currentColId, onMove, onClose,
}: {
  visible:      boolean;
  columns:      Array<{ column_id: string; name: string; color: string }>;
  currentColId: string;
  onMove:       (colId: string) => void;
  onClose:      () => void;
}) {
  const { t } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={[s.pickerSheet, { backgroundColor: t.surface }]} onPress={() => {}}>
          <View style={[s.sheetHandle, { backgroundColor: t.ink3 }]} />
          <Text style={[s.pickerTitle, { color: t.ink }]}>Move to column</Text>
          {columns.filter(c => c.column_id !== currentColId).map(c => (
            <TouchableOpacity
              key={c.column_id}
              style={[s.pickerRow, { borderBottomColor: t.outline }]}
              onPress={() => onMove(c.column_id)}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
              <Text style={[s.pickerName, { color: t.ink }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function TaskDetailScreen() {
  const { t }   = useTheme();
  const { user } = useAuth();
  const route   = useRoute<Route>();
  const nav     = useNavigation<Nav>();
  const qc      = useQueryClient();
  const { taskId } = route.params;

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: task, isLoading, isError } = useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn:  () => tasksApi.get(taskId),
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<Comment[]>({
    queryKey: ['comments', taskId],
    queryFn:  () => tasksApi.getComments(taskId),
    enabled:  !!task,
  });

  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ['members', task?.team_id ?? ''],
    queryFn:  () => projectsApi.members(task!.team_id),
    enabled:  !!task?.team_id,
  });

  const { data: columns = [] } = useQuery({
    queryKey: ['columns', task?.team_id ?? ''],
    queryFn:  () => projectsApi.columns(task!.team_id),
    enabled:  !!task?.team_id,
  });

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [editingTitle, setEditingTitle]   = useState(false);
  const [titleDraft,   setTitleDraft]     = useState('');
  const [editingDesc,  setEditingDesc]    = useState(false);
  const [descDraft,    setDescDraft]      = useState('');
  const [commentText,  setCommentText]    = useState('');
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [newSubtask,   setNewSubtask]     = useState('');
  const [showAssignee, setShowAssignee]   = useState(false);
  const [showMove,     setShowMove]       = useState(false);
  const [approvalAction, setApprovalAction] = useState<'request' | 'approve' | 'reject' | 'client' | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };

  const updateTask = useMutation({
    mutationFn: (body: Partial<Task>) => tasksApi.update(taskId, body),
    onSuccess:  () => invalidate(),
    onError:    (e: any) => Alert.alert('Error', e.message),
  });

  const toggleSubtask = useMutation({
    mutationFn: (subtaskId: string) => tasksApi.toggleSubtask(taskId, subtaskId),
    onMutate:   async (subtaskId) => {
      await qc.cancelQueries({ queryKey: ['task', taskId] });
      const prev = qc.getQueryData<Task>(['task', taskId]);
      qc.setQueryData<Task>(['task', taskId], old => old ? {
        ...old,
        subtasks: old.subtasks.map(s =>
          s.subtask_id === subtaskId ? { ...s, is_done: !s.is_done } : s
        ),
      } : old);
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) qc.setQueryData(['task', taskId], ctx.prev); },
    onSettled: () => invalidate(),
  });

  const addSubtask = useMutation({
    mutationFn: (title: string) => tasksApi.addSubtask(taskId, title),
    onSuccess:  () => { setNewSubtask(''); invalidate(); },
    onError:    (e: any) => Alert.alert('Error', e.message),
  });

  const deleteSubtask = useMutation({
    mutationFn: (subtaskId: string) => tasksApi.deleteSubtask(taskId, subtaskId),
    onSuccess:  () => invalidate(),
  });

  const addComment = useMutation({
    mutationFn: (body: string) => tasksApi.addComment(taskId, body),
    onSuccess:  () => { setCommentText(''); refetchComments(); Keyboard.dismiss(); },
    onError:    (e: any) => Alert.alert('Error', e.message),
  });

  const editComment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => tasksApi.editComment(taskId, id, body),
    onSuccess:  () => { setEditingComment(null); refetchComments(); },
  });

  const deleteComment = useMutation({
    mutationFn: (id: string) => tasksApi.deleteComment(taskId, id),
    onSuccess:  () => refetchComments(),
  });

  const moveTask = useMutation({
    mutationFn: (colId: string) => tasksApi.move(taskId, colId),
    onSuccess:  () => { setShowMove(false); invalidate(); },
    onError:    (e: any) => Alert.alert('Error', e.message),
  });

  const handleApprovalConfirm = async (notes: string, extra?: { client_email?: string }) => {
    try {
      if (approvalAction === 'request') {
        await tasksApi.requestApproval(taskId, notes || undefined);
      } else if (approvalAction === 'approve') {
        await tasksApi.reviewApproval(taskId, 'approved', { notes });
      } else if (approvalAction === 'reject') {
        await tasksApi.reviewApproval(taskId, 'rejected', { notes });
      } else if (approvalAction === 'client') {
        await tasksApi.reviewApproval(taskId, 'pending_client', {
          notes, send_to_client: true, client_email: extra?.client_email,
        });
      }
      setApprovalAction(null);
      invalidate();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleUpload = async (source: 'camera' | 'library' | 'file') => {
    try {
      setUploadingFile(true);
      let uri: string | undefined;
      let name = 'attachment';
      let type = 'application/octet-stream';

      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        uri  = asset.uri;
        name = asset.name;
        type = asset.mimeType ?? type;
      } else {
        const perm = source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Allow access in Settings.'); return; }

        const result = source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85 });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        uri  = asset.uri;
        name = asset.fileName ?? `photo_${Date.now()}.jpg`;
        type = asset.mimeType ?? 'image/jpeg';
      }

      if (!uri) return;
      const fd = new FormData();
      (fd as any).append('file', { uri, name, type });
      await tasksApi.uploadAttachment(taskId, fd);
      invalidate();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload file.');
    } finally {
      setUploadingFile(false);
    }
  };

  const showUploadSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Photo Library', 'Browse Files'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) handleUpload('camera');
          if (idx === 2) handleUpload('library');
          if (idx === 3) handleUpload('file');
        }
      );
    } else {
      Alert.alert('Add Attachment', 'Choose source', [
        { text: 'Camera',        onPress: () => handleUpload('camera') },
        { text: 'Photo Library', onPress: () => handleUpload('library') },
        { text: 'Browse Files',  onPress: () => handleUpload('file') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // ── Assignee toggle ──────────────────────────────────────────────────────────
  const toggleAssignee = (uid: string) => {
    if (!task) return;
    const current = task.assignee_user_ids ?? [];
    const updated  = current.includes(uid)
      ? current.filter(id => id !== uid)
      : [...current, uid];
    updateTask.mutate({ assignee_user_ids: updated });
  };

  // ── Save helpers ─────────────────────────────────────────────────────────────
  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== task?.title) {
      updateTask.mutate({ title: titleDraft.trim() });
    }
  };
  const saveDesc = () => {
    setEditingDesc(false);
    if (descDraft !== (task?.description ?? '')) {
      updateTask.mutate({ description: descDraft });
    }
  };

  // ── Comment long-press ───────────────────────────────────────────────────────
  const onCommentLongPress = (c: Comment) => {
    const isMine = c.user_id === user?.user_id;
    if (!isMine) return;
    Alert.alert('Comment', c.body.slice(0, 80), [
      { text: 'Edit',   onPress: () => { setEditingComment(c); setCommentText(c.body); } },
      { text: 'Delete', style: 'destructive', onPress: () => deleteComment.mutate(c.comment_id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Due date display ─────────────────────────────────────────────────────────
  const dueDisplay = useMemo(() => {
    if (!task?.due_at) return null;
    const d = new Date(task.due_at);
    const isLate = isPast(d) && !isToday(d);
    return { label: format(d, 'd MMM yyyy'), isLate };
  }, [task?.due_at]);

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isLoading) return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <SafeHeader onBack={() => nav.goBack()} title="" t={t} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    </View>
  );

  if (isError || !task) return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <SafeHeader onBack={() => nav.goBack()} title="Task" t={t} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Ionicons name="alert-circle-outline" size={48} color={t.error} />
        <Text style={{ color: t.ink3, fontSize: 14 }}>Could not load task.</Text>
      </View>
    </View>
  );

  const canEdit    = user?.role === 'admin' || user?.role === 'owner' || task.user_id === user?.user_id;
  const priColor   = PRIORITY_COLOR[task.priority] ?? '#636366';
  const assignedMembers = members.filter(m => (task.assignee_user_ids ?? []).includes(memberId(m)));

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {/* ── Top nav ── */}
        <SafeHeader
          onBack={() => nav.goBack()}
          title={task.team_name ?? ''}
          t={t}
          rightActions={
            canEdit ? (
              <TouchableOpacity onPress={() => setShowMove(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="git-branch-outline" size={22} color={t.ink3} />
              </TouchableOpacity>
            ) : null
          }
        />

        {/* ── Scrollable body ── */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ══ TITLE ══ */}
          {editingTitle ? (
            <TextInput
              style={[s.titleInput, { color: t.ink, borderBottomColor: t.primary }]}
              value={titleDraft}
              onChangeText={setTitleDraft}
              onBlur={saveTitle}
              autoFocus
              multiline
              returnKeyType="done"
              blurOnSubmit
            />
          ) : (
            <TouchableOpacity onPress={() => { if (canEdit) { setTitleDraft(task.title); setEditingTitle(true); } }} activeOpacity={canEdit ? 0.7 : 1}>
              <Text style={[s.titleText, { color: t.ink }]}>{task.title}</Text>
            </TouchableOpacity>
          )}

          {/* ══ META CHIPS ══ */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.metaRow} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
            {/* Priority */}
            <TouchableOpacity
              disabled={!canEdit}
              onPress={() => {
                const next: Priority[] = ['urgent', 'high', 'medium', 'low'];
                const idx  = next.indexOf(task.priority);
                updateTask.mutate({ priority: next[(idx + 1) % 4] });
              }}
              style={[s.metaChip, { backgroundColor: priColor + '22', borderColor: priColor }]}
            >
              <Ionicons name={PRI_ICONS[task.priority] as any} size={12} color={priColor} />
              <Text style={[s.metaChipText, { color: priColor }]}>{task.priority}</Text>
            </TouchableOpacity>

            {/* Status */}
            <TouchableOpacity
              disabled={!canEdit}
              onPress={() => {
                const opts: Task['status'][] = ['todo', 'in_progress', 'in_review', 'done'];
                const idx  = opts.indexOf(task.status);
                updateTask.mutate({ status: opts[(idx + 1) % opts.length] });
              }}
              style={[s.metaChip, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}
            >
              <Ionicons name="ellipse" size={8} color={task.status === 'done' ? '#22c55e' : t.ink3} />
              <Text style={[s.metaChipText, { color: t.ink2 }]}>{task.status.replace('_', ' ')}</Text>
            </TouchableOpacity>

            {/* Due date */}
            {dueDisplay && (
              <View style={[s.metaChip, { backgroundColor: dueDisplay.isLate ? '#ef444418' : t.surfaceLow, borderColor: dueDisplay.isLate ? '#ef4444' : t.outline }]}>
                <Ionicons name="calendar-outline" size={12} color={dueDisplay.isLate ? '#ef4444' : t.ink3} />
                <Text style={[s.metaChipText, { color: dueDisplay.isLate ? '#ef4444' : t.ink2 }]}>{dueDisplay.label}</Text>
              </View>
            )}
          </ScrollView>

          <Divider t={t} />

          {/* ══ DESCRIPTION ══ */}
          <Section label="DESCRIPTION" t={t}>
            {editingDesc ? (
              <TextInput
                style={[s.descInput, { color: t.ink, borderColor: t.outline, backgroundColor: t.surfaceLow }]}
                value={descDraft}
                onChangeText={setDescDraft}
                onBlur={saveDesc}
                autoFocus
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                returnKeyType="default"
              />
            ) : (
              <TouchableOpacity onPress={() => { if (canEdit) { setDescDraft(task.description ?? ''); setEditingDesc(true); } }} activeOpacity={0.7}>
                <Text style={[s.descText, { color: task.description ? t.ink2 : t.ink4 }]}>
                  {task.description || (canEdit ? 'Tap to add description…' : '—')}
                </Text>
              </TouchableOpacity>
            )}
          </Section>

          <Divider t={t} />

          {/* ══ ASSIGNEES ══ */}
          <Section label="ASSIGNEES" t={t} action={canEdit ? { icon: 'person-add-outline', onPress: () => setShowAssignee(true) } : undefined}>
            {assignedMembers.length === 0 ? (
              <TouchableOpacity onPress={() => canEdit && setShowAssignee(true)}>
                <Text style={[s.emptyHint, { color: t.ink4 }]}>{canEdit ? 'Tap to assign…' : 'Unassigned'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.assigneeRow}>
                {assignedMembers.map(m => {
                  const uid = memberId(m);
                  const nm  = memberName(m);
                  return (
                    <TouchableOpacity key={uid} onPress={() => canEdit && setShowAssignee(true)} style={s.assigneeChip}>
                      <Avatar uid={uid} name={nm} size={28} />
                      <Text style={[s.assigneeChipName, { color: t.ink2 }]}>{nm.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  );
                })}
                {canEdit && (
                  <TouchableOpacity onPress={() => setShowAssignee(true)} style={[s.assigneeAdd, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}>
                    <Ionicons name="add" size={16} color={t.ink3} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Section>

          <Divider t={t} />

          {/* ══ SUBTASKS ══ */}
          <Section label={`SUBTASKS  ${task.subtasks.length > 0 ? `${task.subtasks.filter(s => s.is_done).length}/${task.subtasks.length}` : ''}`} t={t}>
            {/* Progress bar */}
            {task.subtasks.length > 0 && (
              <View style={[s.subtaskProgress, { backgroundColor: t.outline }]}>
                <View style={[s.subtaskProgressFill, {
                  width: `${(task.subtasks.filter(s => s.is_done).length / task.subtasks.length) * 100}%`,
                  backgroundColor: task.subtasks.every(s => s.is_done) ? '#22c55e' : t.primary,
                }]} />
              </View>
            )}

            {task.subtasks.map(sub => (
              <SubtaskRow
                key={sub.subtask_id}
                sub={sub}
                t={t}
                members={members}
                canEdit={canEdit}
                onToggle={() => toggleSubtask.mutate(sub.subtask_id)}
                onDelete={() => Alert.alert('Delete subtask', `"${sub.title}"?`, [
                  { text: 'Delete', style: 'destructive', onPress: () => deleteSubtask.mutate(sub.subtask_id) },
                  { text: 'Cancel', style: 'cancel' },
                ])}
              />
            ))}

            {canEdit && (
              <View style={s.addSubtaskRow}>
                <TextInput
                  style={[s.addSubtaskInput, { color: t.ink, borderColor: t.outline, backgroundColor: t.surfaceLow }]}
                  value={newSubtask}
                  onChangeText={setNewSubtask}
                  placeholder="Add subtask…"
                  placeholderTextColor={t.ink4}
                  returnKeyType="done"
                  onSubmitEditing={() => { if (newSubtask.trim()) addSubtask.mutate(newSubtask.trim()); }}
                />
                <TouchableOpacity
                  onPress={() => { if (newSubtask.trim()) addSubtask.mutate(newSubtask.trim()); }}
                  disabled={!newSubtask.trim()}
                  style={[s.addSubtaskBtn, { opacity: newSubtask.trim() ? 1 : 0.4, backgroundColor: t.primaryContainer }]}
                >
                  <Ionicons name="add" size={18} color={t.primary} />
                </TouchableOpacity>
              </View>
            )}
          </Section>

          <Divider t={t} />

          {/* ══ APPROVAL ══ */}
          <Section label="APPROVAL" t={t}>
            <ApprovalBanner
              task={task}
              userRole={user?.role ?? 'member'}
              userId={user?.user_id ?? ''}
              onAction={a => setApprovalAction(a)}
            />
          </Section>

          <Divider t={t} />

          {/* ══ ATTACHMENTS ══ */}
          <Section
            label="ATTACHMENTS"
            t={t}
            action={canEdit ? { icon: uploadingFile ? 'hourglass-outline' : 'attach-outline', onPress: showUploadSheet } : undefined}
          >
            {task.attachments.length === 0 && !uploadingFile && (
              <Text style={[s.emptyHint, { color: t.ink4 }]}>{canEdit ? 'Tap + to attach files' : 'No attachments'}</Text>
            )}
            {uploadingFile && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                <ActivityIndicator size="small" color={t.primary} />
                <Text style={{ color: t.ink3, fontSize: 12 }}>Uploading…</Text>
              </View>
            )}
            <View style={s.attachGrid}>
              {task.attachments.map((a, i) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(a.name);
                return (
                  <TouchableOpacity
                    key={a.key ?? i}
                    style={[s.attachChip, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}
                    onPress={() => Linking.openURL(a.url)}
                    onLongPress={() => canEdit && a.key && Alert.alert('Remove attachment', `"${a.name}"?`, [
                      { text: 'Remove', style: 'destructive', onPress: async () => {
                        await tasksApi.deleteAttachment(taskId, a.key!);
                        invalidate();
                      }},
                      { text: 'Cancel', style: 'cancel' },
                    ])}
                  >
                    <Ionicons
                      name={isImage ? 'image-outline' : 'document-outline'}
                      size={14} color={t.primary}
                    />
                    <Text style={[s.attachName, { color: t.ink2 }]} numberOfLines={1}>{a.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Divider t={t} />

          {/* ══ COMMENTS ══ */}
          <Section label={`COMMENTS  ${comments.length > 0 ? comments.length : ''}`} t={t}>
            {comments.length === 0 && (
              <Text style={[s.emptyHint, { color: t.ink4 }]}>No comments yet.</Text>
            )}
            {comments.map(c => (
              <CommentRow
                key={c.comment_id}
                comment={c}
                isMine={c.user_id === user?.user_id}
                t={t}
                onLongPress={() => onCommentLongPress(c)}
              />
            ))}
          </Section>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ── Comment composer ── */}
        <View style={[s.composer, { backgroundColor: t.surface, borderTopColor: t.outline }]}>
          {editingComment && (
            <View style={[s.editingBanner, { backgroundColor: t.primaryContainer }]}>
              <Text style={[s.editingBannerText, { color: t.primary }]}>Editing comment</Text>
              <TouchableOpacity onPress={() => { setEditingComment(null); setCommentText(''); }}>
                <Ionicons name="close" size={16} color={t.primary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.composerRow}>
            {user && <Avatar uid={user.user_id} name={userName(user)} size={30} />}
            <TextInput
              style={[s.composerInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={t.ink4}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              disabled={!commentText.trim() || addComment.isPending || editComment.isPending}
              onPress={() => {
                if (!commentText.trim()) return;
                if (editingComment) {
                  editComment.mutate({ id: editingComment.comment_id, body: commentText.trim() });
                } else {
                  addComment.mutate(commentText.trim());
                }
              }}
              style={[s.sendBtn, { opacity: commentText.trim() ? 1 : 0.4 }]}
            >
              <LinearGradient colors={['#0082c6', '#05b7aa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sendGrad}>
                <Ionicons name="send" size={14} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Modals ── */}
      <AssigneePickerModal
        visible={showAssignee}
        members={members}
        selectedIds={task.assignee_user_ids ?? []}
        onToggle={toggleAssignee}
        onClose={() => setShowAssignee(false)}
      />

      <MoveModal
        visible={showMove}
        columns={columns}
        currentColId={task.column_id}
        onMove={colId => moveTask.mutate(colId)}
        onClose={() => setShowMove(false)}
      />

      <ApprovalModal
        visible={!!approvalAction}
        action={approvalAction}
        onClose={() => setApprovalAction(null)}
        onConfirm={handleApprovalConfirm}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SafeHeader({ onBack, title, t, rightActions }: {
  onBack: () => void; title: string;
  t: any; rightActions?: React.ReactNode;
}) {
  return (
    <View style={[s.safeHeader, { backgroundColor: t.surface, borderBottomColor: t.outline }]}>
      <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-down" size={24} color={t.ink} />
      </TouchableOpacity>
      <Text style={[s.safeHeaderTitle, { color: t.ink3 }]} numberOfLines={1}>{title}</Text>
      <View style={s.headerRight}>{rightActions ?? <View style={{ width: 28 }} />}</View>
    </View>
  );
}

function Divider({ t }: { t: any }) {
  return <View style={[s.divider, { backgroundColor: t.outline }]} />;
}

function Section({ label, t, children, action }: {
  label: string; t: any; children: React.ReactNode;
  action?: { icon: string; onPress: () => void };
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionLabel, { color: t.ink3 }]}>{label}</Text>
        {action && (
          <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name={action.icon as any} size={16} color={t.ink3} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function SubtaskRow({ sub, t, members, canEdit, onToggle, onDelete }: {
  sub: Subtask; t: any; members: TeamMember[];
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const assignee = sub.assignee_user_id
    ? members.find(m => (m.user_id ?? m.member_id) === sub.assignee_user_id)
    : null;

  return (
    <View style={s.subtaskRow}>
      <TouchableOpacity onPress={onToggle}
        style={[s.checkbox, { borderColor: sub.is_done ? '#22c55e' : t.outline, backgroundColor: sub.is_done ? '#22c55e18' : 'transparent' }]}
        {...a11yToggle(sub.title, sub.is_done, sub.is_done ? 'Mark as incomplete' : 'Mark as complete')}>
        {sub.is_done && <Ionicons name="checkmark" size={12} color="#22c55e" accessibilityElementsHidden />}
      </TouchableOpacity>
      <Text style={[s.subtaskTitle, { color: sub.is_done ? t.ink4 : t.ink, textDecorationLine: sub.is_done ? 'line-through' : 'none' }]} numberOfLines={2}>
        {sub.title}
      </Text>
      {assignee && (
        <Avatar uid={(assignee.user_id ?? assignee.member_id) ?? ''} name={memberName(assignee)} size={20} />
      )}
      {canEdit && (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="close" size={14} color={t.ink4} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function CommentRow({ comment, isMine, t, onLongPress }: {
  comment: Comment; isMine: boolean; t: any; onLongPress: () => void;
}) {
  const when = useMemo(() => {
    const d = new Date(comment.created_at);
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'd MMM');
  }, [comment.created_at]);

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      style={[s.commentRow, isMine && s.commentRowMine]}
      activeOpacity={0.85}
    >
      {!isMine && <Avatar uid={comment.user_id} name={comment.user_name} size={30} />}
      <View style={[s.commentBubble, {
        backgroundColor: isMine ? t.primaryContainer : t.surfaceLow,
        borderColor: isMine ? t.primary + '55' : t.outline,
        alignSelf: isMine ? 'flex-end' : 'flex-start',
      }]}>
        {!isMine && (
          <Text style={[s.commentAuthor, { color: t.primary }]}>{comment.user_name}</Text>
        )}
        <Text style={[s.commentBody, { color: t.ink }]}>{comment.body}</Text>
        <Text style={[s.commentTime, { color: t.ink4 }]}>{when}</Text>
      </View>
      {isMine && <Avatar uid={comment.user_id} name={comment.user_name} size={30} />}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1 },
  // Header
  safeHeader:   { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, gap: 8 },
  backBtn:      { width: 28 },
  safeHeaderTitle: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  headerRight:  { width: 28, alignItems: 'flex-end' },
  // Scroll
  scroll:       { paddingBottom: 24 },
  // Title
  titleInput:   { fontSize: 22, fontWeight: '800', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, borderBottomWidth: 2, lineHeight: 30 },
  titleText:    { fontSize: 22, fontWeight: '800', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, lineHeight: 30 },
  // Meta
  metaRow:      { paddingHorizontal: 20, paddingVertical: 10 },
  metaChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1.5 },
  metaChipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  // Section
  section:      { paddingHorizontal: 20, paddingVertical: 14 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  divider:      { height: 1, marginHorizontal: 16 },
  emptyHint:    { fontSize: 13, fontStyle: 'italic' },
  // Description
  descText:     { fontSize: 14, lineHeight: 21 },
  descInput:    { fontSize: 14, lineHeight: 21, borderRadius: 10, borderWidth: 1, padding: 12, minHeight: 80 },
  // Assignees
  assigneeRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assigneeChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assigneeChipName: { fontSize: 12, fontWeight: '700' },
  assigneeAdd:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  // Subtasks
  subtaskProgress: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  subtaskProgressFill: { height: 4, borderRadius: 2 },
  subtaskRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkbox:     { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subtaskTitle: { flex: 1, fontSize: 14, lineHeight: 19 },
  addSubtaskRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  addSubtaskInput:{ flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  addSubtaskBtn:{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  // Approval
  approvalRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  approvalLabel:{ flex: 1, fontSize: 13, fontWeight: '600' },
  approvalBanner:{ borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  approvalBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvalBannerLabel: { fontSize: 13, fontWeight: '700' },
  approvalNotes:{ fontSize: 12, lineHeight: 17 },
  approvalActions:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  approvalBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  // Attachments
  attachGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attachChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, maxWidth: 180 },
  attachName:   { fontSize: 12, fontWeight: '600', flex: 1 },
  // Comments
  commentRow:       { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-end' },
  commentRowMine:   { flexDirection: 'row-reverse' },
  commentBubble:    { flex: 1, borderRadius: 14, padding: 11, borderWidth: 1, maxWidth: '85%' },
  commentAuthor:    { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  commentBody:      { fontSize: 13, lineHeight: 18 },
  commentTime:      { fontSize: 10, marginTop: 5, textAlign: 'right' },
  // Composer
  composer:         { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  editingBanner:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  editingBannerText:{ fontSize: 11, fontWeight: '700' },
  composerRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  composerInput:    { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, maxHeight: 100 },
  sendBtn:          { flexShrink: 0, marginBottom: 2 },
  sendGrad:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Modals
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  approvalModal:    { margin: 16, borderRadius: 20, padding: 22, marginBottom: Platform.OS === 'ios' ? 32 : 16 },
  approvalModalTitle:{ fontSize: 18, fontWeight: '900', marginBottom: 16 },
  approvalModalLabel:{ fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  approvalModalInput:{ borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 4 },
  approvalModalCancelBtn: { paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  approvalModalConfirmBtn:{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pickerSheet:  { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 0, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  pickerTitle:  { fontSize: 17, fontWeight: '900', paddingHorizontal: 20, paddingVertical: 14 },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1 },
  pickerName:   { flex: 1, fontSize: 14, fontWeight: '700' },
  pickerSub:    { fontSize: 12, marginTop: 1 },
  emptyCheck:   { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  pickerDoneBtn:{ margin: 16, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  pickerDoneText:{ fontSize: 14, fontWeight: '800' },
});
