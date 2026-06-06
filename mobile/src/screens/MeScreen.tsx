import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  StyleSheet, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../hooks/useAuth';
import { avatarColor, userInitials } from '../theme/tokens';
import { notificationsApi } from '../api/notifications';
import { apiClient } from '../api/client';
import type { RootStackParamList } from '../nav/RootStack';
import type { NotifKind, NotifPrefsResponse, WhatsAppSettings } from '../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;

const IS_ANDROID = Platform.OS === 'android';

// ── Notification kind rows ────────────────────────────────────────────────────
type KindRow = {
  kind:    NotifKind;
  label:   string;
  hi:      string;
  pushDesc: string;
  tone:    string;
};
const NOTIF_KINDS: KindRow[] = [
  { kind: 'mention',          label: 'Mentions',         hi: 'उल्लेख',       pushDesc: 'Push · email',    tone: 'mention' },
  { kind: 'approval_request', label: 'Approval requests',hi: 'अनुमोदन',      pushDesc: 'Push · email',    tone: 'approval' },
  { kind: 'assigned',         label: 'Assigned to me',   hi: 'असाइन किया',   pushDesc: 'Push (mine)',     tone: 'assigned' },
  { kind: 'comment',          label: 'Comments',         hi: 'टिप्पणियाँ',   pushDesc: 'In-app only',     tone: 'comment' },
  { kind: 'status_changed',   label: 'Status changes',   hi: 'स्थिति',       pushDesc: 'In-app only',     tone: 'status' },
  { kind: 'done',             label: 'Task completed',   hi: 'पूर्ण',        pushDesc: 'Push (project)',  tone: 'success' },
];

const TONE_ICON: Record<string, string> = {
  mention:  'at',
  approval: 'checkmark-circle-outline',
  assigned: 'person-add-outline',
  comment:  'chatbubble-outline',
  status:   'swap-horizontal-outline',
  success:  'checkmark-done-outline',
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  label, hi, caption, children, t,
}: {
  label: string; hi?: string; caption?: string; children: React.ReactNode; t: any;
}) {
  return (
    <View style={sec.wrap}>
      <View style={sec.labelRow}>
        <Text style={[sec.label, { color: t.primary }]}>{label}</Text>
        {hi ? <Text style={[sec.hi, { color: t.ink3 }]}>{hi}</Text> : null}
      </View>
      <View style={[sec.card, {
        backgroundColor: t.surfaceLow,
        borderRadius: IS_ANDROID ? 28 : 16,
      }]}>
        {children}
      </View>
      {caption ? <Text style={[sec.caption, { color: t.ink3 }]}>{caption}</Text> : null}
    </View>
  );
}
const sec = StyleSheet.create({
  wrap:     { paddingHorizontal: 16, paddingBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 6, paddingBottom: 8 },
  label:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  hi:       { fontSize: 12, fontFamily: 'TiroDevanagariHindi' },
  card:     { overflow: 'hidden' },
  caption:  { paddingHorizontal: 6, paddingTop: 6, fontSize: 12, lineHeight: 18 },
});

// ── Settings row (icon + label + value + chevron) ─────────────────────────────
function SettingsRow({
  icon, label, value, valueColor, destructive, sep, t, onPress,
}: {
  icon: string; label: string; value?: string;
  valueColor?: string; destructive?: boolean; sep?: boolean;
  t: any; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[row.wrap, sep && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.outline }]}
    >
      <View style={[row.iconWrap, {
        backgroundColor: destructive ? t.errorBg : t.surface2,
        borderRadius: 99,
      }]}>
        <Ionicons name={icon as any} size={18}
          color={destructive ? t.error : t.ink2} />
      </View>
      <Text style={[row.label, { color: destructive ? t.error : t.ink, fontWeight: destructive ? '600' : '500' }]}>
        {label}
      </Text>
      {value ? (
        <Text style={[row.value, { color: valueColor ?? t.ink2 }]}>{value}</Text>
      ) : null}
      {!destructive ? (
        <Ionicons name="chevron-forward" size={16} color={t.ink3} />
      ) : null}
    </TouchableOpacity>
  );
}
const row = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 18, paddingVertical: 10 },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:    { flex: 1, fontSize: 15 },
  value:    { fontSize: 13, fontWeight: '500' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MeScreen() {
  const { t }            = useTheme();
  const { user, logout } = useAuth();
  const nav              = useNavigation<Nav>();
  const insets           = useSafeAreaInsets();
  const qc               = useQueryClient();

  // WhatsApp state
  const [waPhone,    setWaPhone]    = useState('');
  const [waOtp,      setWaOtp]      = useState('');
  const [waStep,     setWaStep]     = useState<'idle' | 'otp' | 'done'>('idle');
  const [waLoading,  setWaLoading]  = useState(false);
  const [waError,    setWaError]    = useState('');

  const { data: waSetting, refetch: refetchWa } = useQuery<WhatsAppSettings>({
    queryKey: ['whatsapp-settings'],
    queryFn:  () => apiClient.get('/whatsapp/settings').then(r => r.data),
    staleTime: 60_000,
    retry: false,
  });

  async function waOptIn() {
    const phone = waPhone.trim();
    if (!phone) return;
    setWaLoading(true); setWaError('');
    try {
      await apiClient.post('/whatsapp/opt-in', { phone });
      setWaStep('otp');
    } catch (e: any) {
      setWaError(e?.response?.data?.detail || 'Could not send OTP');
    } finally { setWaLoading(false); }
  }

  async function waVerify() {
    if (!waOtp.trim()) return;
    setWaLoading(true); setWaError('');
    try {
      await apiClient.post('/whatsapp/verify', { otp: waOtp.trim() });
      setWaStep('done');
      refetchWa();
    } catch (e: any) {
      setWaError(e?.response?.data?.detail || 'Invalid OTP');
    } finally { setWaLoading(false); }
  }

  async function waOptOut() {
    setWaLoading(true);
    try {
      await apiClient.delete('/whatsapp/opt-out');
      setWaStep('idle'); setWaPhone(''); setWaOtp('');
      refetchWa();
    } catch { /* ignore */ } finally { setWaLoading(false); }
  }

  async function waToggle(key: keyof Pick<WhatsAppSettings, 'notify_approvals' | 'notify_mentions' | 'notify_assignments' | 'notify_dms'>, val: boolean) {
    try { await apiClient.patch('/whatsapp/settings', { [key]: val }); refetchWa(); } catch { /* ignore */ }
  }

  const { data: prefs, isLoading: prefsLoading } = useQuery<NotifPrefsResponse>({
    queryKey: ['notif-prefs'],
    queryFn:  notificationsApi.getPrefs,
    staleTime: 30_000,
  });

  const { mutate: savePrefs } = useMutation({
    mutationFn: (body: NotifPrefsResponse) => notificationsApi.setPrefs(body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notif-prefs'] }),
  });

  function toggleKind(kind: NotifKind, on: boolean) {
    if (!prefs) return;
    const updatedPrefs = { ...(prefs.prefs ?? {}) };
    updatedPrefs[kind] = on ? 'always' : 'off';
    savePrefs({ ...prefs, prefs: updatedPrefs });
  }

  function kindEnabled(kind: NotifKind): boolean {
    const v = prefs?.prefs?.[kind];
    return v !== undefined && v !== 'off';
  }

  const displayName = user?.name ?? user?.full_name ?? '—';
  const initials    = user ? userInitials(user.name ?? user.full_name ?? '?') : '?';
  const bgColor     = user ? avatarColor(user.user_id) : '#0082c6';

  // Badge colors for notif kind icons
  function badgeBg(tone: string): string {
    const map: Record<string, string> = {
      mention:  t.secondaryContainer,
      approval: t.tertiaryContainer,
      assigned: t.purpleContainer,
      comment:  t.primaryContainer,
      status:   t.secondaryContainer,
      success:  t.primaryContainer,
    };
    return map[tone] ?? t.surface2;
  }
  function badgeFg(tone: string): string {
    const map: Record<string, string> = {
      mention:  t.onSecondaryContainer,
      approval: t.onTertiaryContainer,
      assigned: t.purple,
      comment:  t.onPrimaryContainer,
      status:   t.onSecondaryContainer,
      success:  t.onPrimaryContainer,
    };
    return map[tone] ?? t.ink2;
  }

  return (
    <ScrollView
      style={[s.root, { backgroundColor: t.bg }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={[s.header, {
        backgroundColor: IS_ANDROID ? t.surface : t.bg,
        paddingTop: insets.top + (IS_ANDROID ? 8 : 54),
      }]}>
        <View style={s.kickerRow}>
          <Text style={[s.kicker, { color: t.primary }]}>Settings</Text>
          <Text style={[s.kickerHi, { color: t.ink3 }]}>विकल्प</Text>
        </View>
        <Text style={[s.screenTitle, { color: t.ink }]}>You &amp; your app</Text>
      </View>

      {/* ── Account card ─────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 4 }}>
        <View style={[s.accountCard, {
          backgroundColor: t.surfaceLow,
          borderRadius: IS_ANDROID ? 28 : 16,
        }]}>
          <View style={[s.avatarCircle, { backgroundColor: bgColor }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.accountName, { color: t.ink }]}>{displayName}</Text>
            <Text style={[s.accountEmail, { color: t.ink2 }]}>{user?.email ?? ''}</Text>
          </View>
          <View style={[s.roleBadge, { backgroundColor: t.secondaryContainer }]}>
            <Text style={[s.roleText, { color: t.onSecondaryContainer }]}>
              {(user?.role ?? 'member').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Notification toggles ─────────────────────────────────── */}
      <Section
        label="Notifications" hi="सूचनाएँ"
        caption="Mentions and approvals always push. Others can be in-app."
        t={t}
      >
        {prefsLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={t.primary} size="small" />
          </View>
        ) : (
          NOTIF_KINDS.map((k, i) => {
            const enabled = kindEnabled(k.kind);
            const isLast  = i === NOTIF_KINDS.length - 1;
            return (
              <View
                key={k.kind}
                style={[s.notifRow, !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: t.outline,
                }]}
              >
                <View style={[s.notifIcon, { backgroundColor: badgeBg(k.tone), borderRadius: 99 }]}>
                  <Ionicons name={TONE_ICON[k.tone] as any} size={18} color={badgeFg(k.tone)} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={[s.notifLabel, { color: t.ink }]}>{k.label}</Text>
                    <Text style={[s.notifHi, { color: t.ink3 }]}>{k.hi}</Text>
                  </View>
                  <Text style={[s.notifDesc, { color: t.ink2 }]}>{k.pushDesc}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={v => toggleKind(k.kind, v)}
                  trackColor={{ false: t.outline, true: IS_ANDROID ? t.primary : t.primary + 'aa' }}
                  thumbColor={IS_ANDROID
                    ? (enabled ? t.onPrimary : t.outline)
                    : undefined}
                  ios_backgroundColor={t.outline}
                />
              </View>
            );
          })
        )}
      </Section>

      {/* ── WhatsApp ─────────────────────────────────────────────── */}
      <Section
        label="WhatsApp" hi="व्हाट्सऐप"
        caption="Get task alerts on WhatsApp in addition to push notifications."
        t={t}
      >
        {waSetting?.verified ? (
          // Connected — show toggles + disconnect
          <View>
            <View style={[wa.connectedBadge, { borderBottomColor: t.outline }]}>
              <Ionicons name="checkmark-circle" size={18} color="#25D366" />
              <Text style={[wa.connectedText, { color: t.ink }]}>
                Connected · {waSetting.phone}
              </Text>
              <TouchableOpacity onPress={waOptOut} disabled={waLoading} style={{ marginLeft: 'auto' }}>
                {waLoading
                  ? <ActivityIndicator size="small" color={t.ink3} />
                  : <Text style={{ fontSize: 12, color: t.error, fontWeight: '600' }}>Disconnect</Text>
                }
              </TouchableOpacity>
            </View>
            {([
              { key: 'notify_approvals',   label: 'Approvals',   hi: 'अनुमोदन' },
              { key: 'notify_mentions',    label: 'Mentions',    hi: 'उल्लेख' },
              { key: 'notify_assignments', label: 'Assignments', hi: 'असाइनमेंट' },
              { key: 'notify_dms',         label: 'Direct messages', hi: 'संदेश' },
            ] as const).map((row, i, arr) => (
              <View key={row.key} style={[s.notifRow, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.outline }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={[s.notifLabel, { color: t.ink }]}>{row.label}</Text>
                    <Text style={[s.notifHi, { color: t.ink3 }]}>{row.hi}</Text>
                  </View>
                </View>
                <Switch
                  value={!!(waSetting as any)[row.key]}
                  onValueChange={v => waToggle(row.key, v)}
                  trackColor={{ false: t.outline, true: IS_ANDROID ? t.primary : t.primary + 'aa' }}
                  thumbColor={IS_ANDROID ? ((waSetting as any)[row.key] ? t.onPrimary : t.outline) : undefined}
                  ios_backgroundColor={t.outline}
                />
              </View>
            ))}
          </View>
        ) : waSetting?.opted_in && !waSetting.verified || waStep === 'otp' ? (
          // OTP step
          <View style={wa.form}>
            <Text style={[wa.hint, { color: t.ink2 }]}>
              Enter the 6-digit OTP sent to your WhatsApp number.
            </Text>
            <TextInput
              value={waOtp}
              onChangeText={v => { setWaOtp(v); setWaError(''); }}
              placeholder="6-digit OTP"
              placeholderTextColor={t.ink3}
              keyboardType="number-pad"
              maxLength={6}
              style={[wa.input, { borderColor: waError ? '#dc2626' : t.outline, color: t.ink, backgroundColor: t.bg }]}
            />
            {waError ? <Text style={wa.err}>{waError}</Text> : null}
            <View style={wa.actions}>
              <TouchableOpacity onPress={() => apiClient.post('/whatsapp/resend-otp').catch(() => {})}
                style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, color: t.primary }}>Resend OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={waVerify} disabled={waLoading || waOtp.length < 6}
                style={[wa.btn, { backgroundColor: waOtp.length < 6 ? t.outline : t.primary }]}>
                {waLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={wa.btnText}>Verify</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Not connected — phone entry
          <View style={wa.form}>
            <Text style={[wa.hint, { color: t.ink2 }]}>
              Enter your WhatsApp number in international format (+91…).
            </Text>
            <TextInput
              value={waPhone}
              onChangeText={v => { setWaPhone(v); setWaError(''); }}
              placeholder="+91 98765 43210"
              placeholderTextColor={t.ink3}
              keyboardType="phone-pad"
              style={[wa.input, { borderColor: waError ? '#dc2626' : t.outline, color: t.ink, backgroundColor: t.bg }]}
            />
            {waError ? <Text style={wa.err}>{waError}</Text> : null}
            <TouchableOpacity onPress={waOptIn} disabled={waLoading || !waPhone.trim()}
              style={[wa.btn, { backgroundColor: !waPhone.trim() ? t.outline : '#25D366', opacity: !waPhone.trim() ? 0.5 : 1 }]}>
              {waLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={wa.btnText}>Connect WhatsApp</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </Section>

      {/* ── Permissions ──────────────────────────────────────────── */}
      <Section label="Permissions" hi="अनुमतियाँ"
        caption="Approval pushes need Notifications enabled."
        t={t}
      >
        <SettingsRow t={t} icon="notifications-outline"    label="Notifications"  value="Granted"       valueColor={t.primary}   sep />
        <SettingsRow t={t} icon="camera-outline"            label="Camera"         value="Granted"       valueColor={t.primary}   sep />
        <SettingsRow t={t} icon="mic-outline"               label="Microphone"     value="Ask each time" valueColor={t.approval}  sep />
        <SettingsRow t={t} icon="images-outline"            label="Photos & files" value="All photos"    valueColor={t.primary} />
      </Section>

      {/* ── Sync & data ──────────────────────────────────────────── */}
      <Section label="Sync & data" hi="संग्रह"
        caption="Reset clears local cache only — server data is safe."
        t={t}
      >
        <SettingsRow t={t} icon="sync-outline"     label="Sync status"  value="Up to date"  sep />
        <SettingsRow t={t} icon="time-outline"     label="Last synced"  value="Just now"    sep />
        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.syncBtn, { backgroundColor: t.primary }]}
          >
            <Ionicons name="sync-outline" size={16} color={t.onPrimary} />
            <Text style={[s.syncBtnText, { color: t.onPrimary }]}>Sync now</Text>
          </TouchableOpacity>
        </View>
        <SettingsRow t={t} icon="trash-outline" label="Reset app data" destructive />
      </Section>

      {/* ── Preferences ──────────────────────────────────────────── */}
      <Section label="Preferences" hi="मनपसंद" t={t}>
        <SettingsRow t={t} icon="color-palette-outline" label="Theme"        value="System"          sep onPress={() => nav.navigate('Settings')} />
        <SettingsRow t={t} icon="grid-outline"           label="Default view" value="Board"           sep onPress={() => nav.navigate('Settings')} />
        <SettingsRow t={t} icon="language-outline"       label="Language"     value="English · हिन्दी"   onPress={() => nav.navigate('Settings')} />
      </Section>

      {/* ── App settings ─────────────────────────────────────────── */}
      <Section label="App Settings" hi="ऐप" t={t}>
        <SettingsRow t={t} icon="settings-outline" label="All settings" value="सभी सेटिंग्स"
          sep onPress={() => nav.navigate('Settings')} />
        <SettingsRow t={t} icon="information-circle-outline" label="Version" value="2.0 · build 7" />
      </Section>

      {/* ── About ────────────────────────────────────────────────── */}
      <Section label="About" hi="सूचना" t={t}>
        <SettingsRow t={t} icon="shield-checkmark-outline" label="Privacy policy"  sep />
        <SettingsRow t={t} icon="document-text-outline"    label="Terms of service" />
      </Section>

      {/* ── Sign out ─────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={logout}
          activeOpacity={0.8}
          style={[s.signOutBtn, { borderColor: t.error }]}
        >
          <Text style={[s.signOutText, { color: t.error }]}>Sign out</Text>
        </TouchableOpacity>
        <Text style={[s.footer, { color: t.ink3 }]}>KARTAVYA · BY AEKAM INC</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  kickerHi: {
    fontSize: 12,
    fontFamily: 'TiroDevanagariHindi',
  },
  screenTitle: {
    fontSize: IS_ANDROID ? 30 : 34,
    fontWeight: IS_ANDROID ? '500' : '400',
    lineHeight: IS_ANDROID ? 36 : 40,
    letterSpacing: -0.5,
    marginBottom: 8,
    fontFamily: IS_ANDROID ? undefined : 'Newsreader',
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    paddingHorizontal: 18,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 19, fontWeight: '600', letterSpacing: 0.2 },
  accountName: { fontSize: 17, fontWeight: '600' },
  accountEmail: { fontSize: 13, marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  roleText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  notifIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifLabel: { fontSize: 15, fontWeight: '500' },
  notifHi:    { fontSize: 11, fontFamily: 'TiroDevanagariHindi' },
  notifDesc:  { fontSize: 12.5, marginTop: 2 },

  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 99,
  },
  syncBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },

  signOutBtn: {
    height: 48,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  footer: {
    textAlign: 'center',
    marginTop: 14,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
  },
});

const wa = StyleSheet.create({
  connectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  connectedText: { fontSize: 14, fontWeight: '500' },
  form:    { padding: 18, gap: 10 },
  hint:    { fontSize: 13, lineHeight: 19 },
  input:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  err:     { fontSize: 12, color: '#dc2626' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn:     { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
