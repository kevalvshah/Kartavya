/**
 * MessagesScreen — संवाद
 * Channel list with project channels + direct messages.
 * Tap a channel → navigates to MessageThreadScreen.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
  Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { messagingApi } from '../api/messaging';
import type { Channel } from '../api/types';
import type { RootStackParamList } from '../nav/RootStack';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const IS_ANDROID = Platform.OS === 'android';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function ChannelRow({
  ch, onPress, t,
}: {
  ch: Channel;
  onPress: () => void;
  t: ReturnType<typeof useTheme>['t'];
}) {
  const label = ch.type === 'dm'
    ? (ch.name || 'Direct Message')
    : `#​${ch.name || ch.project_name || 'channel'}`;
  const icon  = ch.type === 'dm' ? 'person-circle-outline' : 'chatbubbles-outline';
  const hasUnread = (ch.unread_count ?? 0) > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[s.channelRow, { borderBottomColor: t.outline }]}>
      <View style={[s.chIcon, { backgroundColor: hasUnread ? t.primaryContainer : t.surface2 }]}>
        <Ionicons name={icon as any} size={18}
          color={hasUnread ? t.onPrimaryContainer : t.ink3} />
      </View>
      <View style={s.chBody}>
        <View style={s.chTop}>
          <Text style={[s.chName, { color: t.ink, fontWeight: hasUnread ? '700' : '500' }]}
            numberOfLines={1}>{label}</Text>
          <Text style={[s.chTime, { color: t.ink3 }]}>{timeAgo(ch.last_message_at)}</Text>
        </View>
        {ch.last_message ? (
          <Text style={[s.chPreview, { color: t.ink2, fontWeight: hasUnread ? '600' : '400' }]}
            numberOfLines={1}>{ch.last_message}</Text>
        ) : null}
      </View>
      {hasUnread ? (
        <View style={[s.badge, { backgroundColor: t.primary }]}>
          <Text style={s.badgeText}>
            {ch.unread_count > 99 ? '99+' : ch.unread_count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const { t }    = useTheme();
  const nav      = useNavigation<Nav>();
  const insets   = useSafeAreaInsets();
  const qc       = useQueryClient();

  const [search,       setSearch]       = useState('');
  const [showDmModal,  setShowDmModal]  = useState(false);
  const [dmEmail,      setDmEmail]      = useState('');
  const [dmLoading,    setDmLoading]    = useState(false);
  const [dmError,      setDmError]      = useState('');

  const { data: channels = [], isLoading, refetch } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn:  messagingApi.channels,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const filtered = search.trim()
    ? channels.filter(c => {
        const label = c.name || c.project_name || '';
        return label.toLowerCase().includes(search.toLowerCase());
      })
    : channels;

  const projectChs = filtered.filter(c => c.type !== 'dm');
  const dmChs      = filtered.filter(c => c.type === 'dm');

  const openChannel = (ch: Channel) => {
    messagingApi.markRead(ch.channel_id).catch(() => {});
    qc.setQueryData<Channel[]>(['channels'], prev =>
      prev?.map(c => c.channel_id === ch.channel_id ? { ...c, unread_count: 0 } : c) ?? prev
    );
    nav.navigate('MessageThread', {
      channelId:   ch.channel_id,
      channelName: ch.type === 'dm'
        ? (ch.name || 'Direct Message')
        : `#${ch.name || ch.project_name || 'channel'}`,
      channelType: ch.type,
    });
  };

  const startDm = useCallback(async () => {
    const email = dmEmail.trim();
    if (!email) return;
    setDmLoading(true); setDmError('');
    try {
      const r = await messagingApi.startDm(email);
      setShowDmModal(false); setDmEmail('');
      qc.invalidateQueries({ queryKey: ['channels'] });
      const ch = channels.find(c => c.channel_id === r.channel_id);
      nav.navigate('MessageThread', {
        channelId:   r.channel_id,
        channelName: ch?.name || email,
        channelType: 'dm',
      });
    } catch (e: any) {
      setDmError(e?.response?.data?.detail || 'User not found');
    } finally {
      setDmLoading(false);
    }
  }, [dmEmail, channels, nav, qc]);

  const SectionHeader = ({ label, hi, action }: { label: string; hi: string; action?: React.ReactNode }) => (
    <View style={[sectionHead.row, { backgroundColor: t.bg }]}>
      <Text style={[sectionHead.label, { color: t.primary }]}>{label}</Text>
      <Text style={[sectionHead.hi, { color: t.ink3 }]}>{hi}</Text>
      {action}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[s.header, {
        backgroundColor: IS_ANDROID ? t.surface : t.bg,
        paddingTop: insets.top + (IS_ANDROID ? 8 : 54),
      }]}>
        <View>
          <View style={s.kickerRow}>
            <Text style={[s.kicker, { color: t.primary }]}>Messaging</Text>
            <Text style={[s.kickerHi, { color: t.ink3 }]}>संवाद</Text>
          </View>
          <Text style={[s.screenTitle, { color: t.ink }]}>Messages</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}>
        <Ionicons name="search" size={16} color={t.ink3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search channels…"
          placeholderTextColor={t.ink3}
          style={[s.searchInput, { color: t.ink }]}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={t.ink3} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={() => (
            <>
              {/* Project channels */}
              <SectionHeader label="Channels" hi="चैनल" />
              {projectChs.length === 0 ? (
                <Text style={[s.emptySection, { color: t.ink3 }]}>No channels yet</Text>
              ) : (
                projectChs.map(ch => (
                  <ChannelRow key={ch.channel_id} ch={ch} t={t} onPress={() => openChannel(ch)} />
                ))
              )}

              {/* DMs */}
              <SectionHeader
                label="Direct Messages"
                hi="संदेश"
                action={
                  <TouchableOpacity onPress={() => { setDmEmail(''); setDmError(''); setShowDmModal(true); }}
                    hitSlop={8} style={{ marginLeft: 'auto' }}>
                    <Ionicons name="add-circle-outline" size={20} color={t.primary} />
                  </TouchableOpacity>
                }
              />
              {dmChs.length === 0 ? (
                <Text style={[s.emptySection, { color: t.ink3 }]}>No direct messages yet</Text>
              ) : (
                dmChs.map(ch => (
                  <ChannelRow key={ch.channel_id} ch={ch} t={t} onPress={() => openChannel(ch)} />
                ))
              )}
              <View style={{ height: insets.bottom + 100 }} />
            </>
          )}
          keyExtractor={() => 'header'}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
        />
      )}

      {/* New DM modal */}
      <Modal visible={showDmModal} transparent animationType="fade" onRequestClose={() => setShowDmModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowDmModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalWrap}>
          <View style={[s.modalCard, { backgroundColor: t.surface }]}>
            <Text style={[s.modalTitle, { color: t.ink }]}>New Direct Message</Text>
            <Text style={[s.modalSub, { color: t.ink2 }]}>संदेश भेजें</Text>
            <TextInput
              value={dmEmail}
              onChangeText={v => { setDmEmail(v); setDmError(''); }}
              placeholder="Email address…"
              placeholderTextColor={t.ink3}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
              style={[s.modalInput, { borderColor: dmError ? '#dc2626' : t.outline, color: t.ink, backgroundColor: t.bg }]}
              onSubmitEditing={startDm}
            />
            {dmError ? <Text style={s.dmError}>{dmError}</Text> : null}
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowDmModal(false)}
                style={[s.modalBtn, { backgroundColor: t.surface2 }]}>
                <Text style={[s.modalBtnText, { color: t.ink2 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startDm} disabled={dmLoading || !dmEmail.trim()}
                style={[s.modalBtn, { backgroundColor: t.primary, opacity: !dmEmail.trim() ? 0.5 : 1 }]}>
                {dmLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[s.modalBtnText, { color: '#fff' }]}>Start</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const sectionHead = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  hi:    { fontSize: 12, fontFamily: 'TiroDevanagariHindi' },
});

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 16, paddingBottom: 4 },
  kickerRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  kicker:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  kickerHi:   { fontSize: 12, fontFamily: 'TiroDevanagariHindi' },
  screenTitle: {
    fontSize: IS_ANDROID ? 30 : 34,
    fontWeight: IS_ANDROID ? '500' : '400',
    letterSpacing: -0.5,
    marginBottom: 8,
    fontFamily: IS_ANDROID ? undefined : 'Newsreader',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  channelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chBody: { flex: 1, minWidth: 0 },
  chTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chName: { flex: 1, fontSize: 15 },
  chTime: { fontSize: 12 },
  chPreview: { fontSize: 13, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  emptySection: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, fontStyle: 'italic' },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalWrap:  { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalCard:  { borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 2 },
  modalSub:   { fontSize: 13, fontFamily: 'TiroDevanagariHindi', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 6 },
  dmError:    { fontSize: 12, color: '#dc2626', marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn:     { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});
