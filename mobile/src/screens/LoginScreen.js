import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiLogin } from '../api';
import { K } from '../theme';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiLogin(email.trim().toLowerCase(), password);
      onLogin?.(data.user);
    } catch (err) {
      Alert.alert('Sign in failed', err?.response?.data?.detail || 'Check your credentials and try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[K.dark, K.navy, '#060e1e']} style={s.bg}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={s.logoSection}>
            <LinearGradient colors={K.gradD} style={s.logoBox}>
              <Text style={s.logoMark}>◆</Text>
            </LinearGradient>
            <Text style={s.brand}>KARTAVYA</Text>
            <Text style={s.brandSub}>by Aekam Inc</Text>
            <Text style={s.tagline}>Do what must be done.</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Sign In</Text>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={K.muted}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            />
            <Text style={[s.label, { marginTop: 14 }]}>PASSWORD</Text>
            <TextInput
              style={s.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={K.muted}
              secureTextEntry returnKeyType="go" onSubmitEditing={submit}
            />
            <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.85} style={{ marginTop: 20 }}>
              <LinearGradient colors={K.grad} style={s.btn}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.note}>Access is invite-only.{"\n"}Contact your admin to get access.</Text>
          </View>

          <Text style={s.powered}>Powered by Aekam Inc</Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bg:          { flex: 1 },
  scroll:      { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoBox:     { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoMark:    { color: '#fff', fontSize: 36, fontWeight: '900' },
  brand:       { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 5, marginBottom: 4 },
  brandSub:    { color: '#05b7aa', fontSize: 10, fontWeight: '700', letterSpacing: 3 },
  tagline:     { color: '#8aa5be', fontSize: 14, marginTop: 14, fontStyle: 'italic' },
  card:        { backgroundColor: '#0b1829', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(0,130,198,0.3)' },
  cardTitle:   { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 20 },
  label:       { color: '#8aa5be', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  input:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,130,198,0.25)', paddingHorizontal: 14, paddingVertical: 13, color: '#fff', fontSize: 14 },
  btn:         { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  btnText:     { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  note:        { color: '#8aa5be', fontSize: 11, textAlign: 'center', marginTop: 18, lineHeight: 18 },
  powered:     { color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center', marginTop: 36, letterSpacing: 2 },
});
