import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { apiLogin } from '../api';
import { K, FONT } from '../theme';

export default function LoginScreen({ route }) {
  const { onLogin } = route.params || {};
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { Alert.alert('Missing fields', 'Enter your email and password.'); return; }
    setLoading(true);
    try {
      const data = await apiLogin(email.trim().toLowerCase(), password);
      onLogin?.(data.user);
    } catch (err) {
      Alert.alert('Sign in failed', err?.response?.data?.detail || 'Check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={[K.dark, K.navy]} style={s.bg}>
        <ScrollView contentContainerStyle={s.scroll}>
          {/* Logo */}
          <View style={s.logoSection}>
            <LinearGradient colors={K.gradD} style={s.logoBox}>
              <Text style={s.logoMark}>◆</Text>
            </LinearGradient>
            <Text style={s.brand}>KARTAVYA</Text>
            <Text style={s.brandSub}>by Aekam Inc</Text>
            <Text style={s.tagline}>Do what must be done.</Text>
          </View>

          {/* Form card */}
          <View style={s.card}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={K.muted}
              autoCapitalize="none" keyboardType="email-address"
            />
            <Text style={[s.label, { marginTop: 14 }]}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={K.muted}
              secureTextEntry
            />
            <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={K.grad} style={s.btn}>
                <Text style={s.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.note}>Access is invite-only.{"\n"}Contact your admin for access.</Text>
          </View>

          <Text style={s.powered}>Powered by Aekam Inc</Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bg:          { flex: 1 },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoBox:     { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoMark:    { color: '#fff', fontSize: 32, fontWeight: '900' },
  brand:       { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 5, marginBottom: 4 },
  brandSub:    { color: K.teal, fontSize: 10, fontWeight: '700', letterSpacing: 3 },
  tagline:     { color: K.muted, fontSize: 14, marginTop: 12, fontStyle: 'italic' },
  card:        { backgroundColor: K.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(0,130,198,0.3)' },
  label:       { color: K.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  input:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.25)', paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14, marginBottom: 4 },
  btn:         { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnText:     { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  note:        { color: K.muted, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  powered:     { color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center', marginTop: 32, letterSpacing: 2 },
});
