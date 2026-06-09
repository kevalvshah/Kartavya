/**
 * MessageThreadScreen — full message thread for a channel.
 * Supports send, react (long-press), and threaded replies.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { messagingApi } from '../api/messaging';
import { avatarColor, userInitials } from '../theme/tokens';
import type { Message } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Route = RouteProp<RootStackParamList, 'MessageThread'>;

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🙏', '🎉', '👀', '✅', '🔥'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function MessageBubble({
  msg, isOwn, t, onLongPress, onReplyPress,
}: {
  msg: Message;
  isOwn: boolean;
  t: ReturnType<typeof useTheme>['t'];
  onLongPress: () => void;
  onReplyPress: () => void;
}) {
  const initials = userInitials(msg.sender_name);
  const bg       = avatarColor(msg.sender_id);

  if (msg.deleted) {
    return (
      <View style={[mb.row, isOwn && mb.rowOwn]}>
        <Text style={[mb.deleted, { color: t.ink3 }]}>Message deleted</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onLongPress={onLongPress} activeOpacity={0.85} style={[mb.row, isOwn && mb.rowOwn]}>
      {!isOwn && (
        <View style={[mb.avatar, { backgroundColor: bg }]}>
          <Text style={mb.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={[mb.bubble, isOwn
        ? { backgroundColor: t.primary, borderBottomRightRadius: 4 }
        : { backgroundColor: t.surfaceLow, borderBottomLeftRadius: 4 }
      ]}>
        {!isOwn && (
          <Text style={[mb.senderName, { color: t.primary }]}>{msg.sender_name}</Text>
        )}
        <Text style={[mb.body, { color: isOwn ? '#fff' : t.ink }]}>{msg.body}</Text>
        <View style={mb.meta}>
          {msg.edited_at && (
            <Text style={[mb.edited, { color: isOwn ? 'rgba(255,255,255,0.6)' : t.ink3 }]}>edited</Text>
          )}
          <Text style={[mb.time, { color: isOwn ? 'rgba(255,255,255,0.65)' : t.ink3 }]}>
            {formatTime(msg.created_at)}
          </Text>
        </View>
        {/* Reactions */}
        {msg.reactions.length > 0 && (
          <View style={mb.reactions}>
            {Object.entries(
              msg.reactions.reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc;
              }, {})
            ).map(([emoji, count]) => (
              <View key={emoji} style={[mb.reactionChip, { backgroundColor: t.surface2 }]}>
                <Text style={mb.reactionEmoji}>{emoji}</Text>
                <Text style={[mb.reactionCount, { color: t.ink2 }]}>{count}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Reply count */}
        {msg.reply_count > 0 && (
          <TouchableOpacity onPress={onReplyPress} style={mb.replyBtn}>
            <Text style={[mb.replyBtnText, { color: isOwn ? 'rgba(255,255,255,0.75)' : t.primary }]}>
              {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'} →
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {isOwn && <View style={{ width: 30 }} />}
    </TouchableOpacity>
  );
}

const mb = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, marginBottom: 6 },
  rowOwn:      { flexDirection: 'row-reverse' },
  avatar:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  avatarText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble:      { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  senderName:  { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  body:        { fontSize: 15, lineHeight: 21 },
  meta:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  time:        { fontSize: 10.5 },
  edited:      { fontSize: 10, fontStyle: 'italic' },
  deleted:     { fontSize: 13, fontStyle: 'italic', padding: 8 },
  reactions:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionChip:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  reactionEmoji:  { fontSize: 14 },
  reactionCount:  { fontSize: 12, fontWeight: '600' },
  replyBtn:       { marginTop: 4 },
  replyBtnText:   { fontSize: 12, fontWeight: '600' },
});

export default function MessageThreadScreen() {
  const { t }    = useTheme();
  const { user } = useAuth();
  const nav      = useNavigation();
  const route    = useRoute<Route>();
  const insets   = useSafeAreaInsets();
  const qc       = useQueryClient();
  const listRef  = useRef<FlatList>(null);

  const { channelId, channelName, channelType } = route.params;

  const [compose,      setCompose]      = useState('');
  const [reactionMsg,  setReactionMsg]  = useState<Message | null>(null);
  const [replyTo,      setReplyTo]      = useState<Message | null>(null);
  const [threadMsg,    setThreadMsg]    = useState<Message | null>(null);
  const [sending,      setSending]      = useState(false);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages', channelId],
    queryFn:  () => messagingApi.messages(channelId),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const { data: threadReplies = [] } = useQuery<Message[]>({
    queryKey: ['replies', channelId, threadMsg?.message_id],
    queryFn:  () => messagingApi.replies(channelId, threadMsg!.message_id),
    enabled:  !!threadMsg,
    staleTime: 5_000,
  });

  // Mark read on mount
  useEffect(() => {
    messagingApi.markRead(channelId).catch(() => {});
    qc.invalidateQueries({ queryKey: ['channels'] });
  }, [channelId, qc]);

  const sendMessage = useCallback(async (body: string, parentId?: string) => {
    if (!body.trim() || sending) return;
    setSending(true);
    const trimmed = body.trim();
    setCompose('');
    setReplyTo(null);
    try {
      const msg = await messagingApi.send(channelId, trimmed, parentId);
      qc.setQueryData<Message[]>(['messages', channelId], prev => [...(prev ?? []), msg]);
      if (parentId) {
        qc.invalidateQueries({ queryKey: ['replies', channelId, parentId] });
        qc.setQueryData<Message[]>(['messages', channelId], prev =>
          prev?.map(m => m.message_id === parentId ? { ...m, reply_count: m.reply_count + 1 } : m) ?? prev
        );
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { /* silently fail */ }
    finally { setSending(false); }
  }, [channelId, sending, qc]);

  const reactToMessage = useCallback(async (msg: Message, emoji: string) => {
    setReactionMsg(null);
    await messagingApi.react(msg.message_id, emoji).catch(() => {});
    qc.invalidateQueries({ queryKey: ['messages', channelId] });
    if (threadMsg) qc.invalidateQueries({ queryKey: ['replies', channelId, threadMsg.message_id] });
  }, [channelId, threadMsg, qc]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      msg={item}
      isOwn={item.sender_id === user?.user_id}
      t={t}
      onLongPress={() => setReactionMsg(item)}
      onReplyPress={() => setThreadMsg(item)}
    />
  );

  const ComposeBar = ({ onSend, placeholder }: { onSend: (body: string) => void; placeholder?: string }) => (
    <View style={[s.composeBar, {
      backgroundColor: t.surface,
      borderTopColor: t.outline,
      paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 0 : 8),
    }]}>
      {replyTo && (
        <View style={[s.replyPreview, { backgroundColor: t.primaryContainer, borderLeftColor: t.primary }]}>
          <Text style={[s.replyPreviewText, { color: t.onPrimaryContainer }]} numberOfLines={1}>
            Replying to {replyTo.sender_name}: {replyTo.body}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
            <Ionicons name="close" size={14} color={t.onPrimaryContainer} />
          </TouchableOpacity>
        </View>
      )}
      <View style={s.composeRow}>
        <TextInput
          value={compose}
          onChangeText={setCompose}
          placeholder={placeholder ?? 'Message…'}
          placeholderTextColor={t.ink3}
          style={[s.composeInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
          multiline
          maxLength={2000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => { if (!Platform.OS === false) onSend(compose); }}
        />
        <TouchableOpacity
          onPress={() => onSend(compose)}
          disabled={!compose.trim() || sending}
          style={[s.sendBtn, { backgroundColor: !compose.trim() ? t.outline : t.primary }]}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="arrow-up" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[s.header, {
        backgroundColor: t.surface,
        borderBottomColor: t.outline,
        paddingTop: insets.top + (IS_ANDROID ? 8 : 0),
      }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={t.primary} />
        </TouchableOpacity>
        <View style={s.headerTitles}>
          <Text style={[s.headerTitle, { color: t.ink }]} numberOfLines={1}>{channelName}</Text>
          <Text style={[s.headerSub, { color: t.ink3 }]}>
            {channelType === 'dm' ? 'Direct message · संदेश' : 'Channel · चैनल'}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>💬</Text>
            <Text style={[s.emptyTitle, { color: t.ink2 }]}>No messages yet</Text>
            <Text style={[s.emptySub, { color: t.ink3 }]}>Be the first to say something.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={m => m.message_id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}
        <ComposeBar onSend={body => sendMessage(body, replyTo?.message_id)} />
      </KeyboardAvoidingView>

      {/* Reaction picker */}
      <Modal visible={!!reactionMsg} transparent animationType="fade"
        onRequestClose={() => setReactionMsg(null)}>
        <Pressable style={s.emojiBackdrop} onPress={() => setReactionMsg(null)} />
        <View style={s.emojiPickerWrap}>
          <View style={[s.emojiCard, { backgroundColor: t.surface }]}>
            <Text style={[s.emojiTitle, { color: t.ink2 }]}>React to message</Text>
            <View style={s.emojiGrid}>
              {QUICK_EMOJIS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => reactionMsg && reactToMessage(reactionMsg, emoji)}
                  style={[s.emojiBtn, { backgroundColor: t.bg }]}>
                  <Text style={s.emojiChar}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => { if (reactionMsg) { setReplyTo(reactionMsg); setReactionMsg(null); } }}
              style={[s.replyAction, { backgroundColor: t.primaryContainer }]}
            >
              <Ionicons name="return-down-forward" size={15} color={t.onPrimaryContainer} />
              <Text style={[s.replyActionText, { color: t.onPrimaryContainer }]}>Reply in thread</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Thread modal */}
      <Modal visible={!!threadMsg} transparent animationType="slide"
        onRequestClose={() => setThreadMsg(null)}>
        <Pressable style={s.threadBackdrop} onPress={() => setThreadMsg(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.threadSheet}>
          <View style={[s.threadCard, { backgroundColor: t.surface }]}>
            <View style={[s.threadHeader, { borderBottomColor: t.outline }]}>
              <Text style={[s.threadTitle, { color: t.ink }]}>Thread</Text>
              <TouchableOpacity onPress={() => setThreadMsg(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color={t.ink3} />
              </TouchableOpacity>
            </View>
            {threadMsg && (
              <View style={[s.parentMsg, { borderBottomColor: t.outline }]}>
                <Text style={[s.parentSender, { color: t.primary }]}>{threadMsg.sender_name}</Text>
                <Text style={[s.parentBody, { color: t.ink }]}>{threadMsg.body}</Text>
              </View>
            )}
            <FlatList
              data={threadReplies}
              renderItem={renderMessage}
              keyExtractor={m => m.message_id}
              contentContainerStyle={{ paddingVertical: 8 }}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            />
            <View style={[s.composeBar, {
              backgroundColor: t.surface,
              borderTopColor: t.outline,
              paddingBottom: insets.bottom + 4,
            }]}>
              <View style={s.composeRow}>
                <TextInput
                  value={compose}
                  onChangeText={setCompose}
                  placeholder="Reply…"
                  placeholderTextColor={t.ink3}
                  style={[s.composeInput, { backgroundColor: t.bg, borderColor: t.outline, color: t.ink }]}
                  multiline maxLength={2000}
                />
                <TouchableOpacity
                  onPress={() => threadMsg && sendMessage(compose, threadMsg.message_id)}
                  disabled={!compose.trim() || sending}
                  style={[s.sendBtn, { backgroundColor: !compose.trim() ? t.outline : t.primary }]}
                >
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const IS_ANDROID = Platform.OS === 'android';

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:      { padding: 4 },
  headerTitles: { flex: 1, minWidth: 0 },
  headerTitle:  { fontSize: 17, fontWeight: '600' },
  headerSub:    { fontSize: 12, marginTop: 1, fontFamily: 'TiroDevanagariHindi' },

  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  emptySub:   { fontSize: 14 },

  composeBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4,
    marginBottom: 6, borderRadius: 4,
  },
  replyPreviewText: { flex: 1, fontSize: 12, fontStyle: 'italic' },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composeInput: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  emojiBackdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  emojiPickerWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 40 },
  emojiCard:       { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  emojiTitle:      { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  emojiGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  emojiBtn:        { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emojiChar:       { fontSize: 26 },
  replyAction:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  replyActionText: { fontSize: 14, fontWeight: '600' },

  threadBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  threadSheet:    { flex: 1, justifyContent: 'flex-end' },
  threadCard:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  threadHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  threadTitle:    { fontSize: 16, fontWeight: '600' },
  parentMsg:      { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  parentSender:   { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  parentBody:     { fontSize: 14, lineHeight: 20 },
});
