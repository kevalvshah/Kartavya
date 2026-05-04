import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { K } from '../theme';

export default function KHeader({ title, subtitle, onBack, rightAction }) {
  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <LinearGradient colors={K.gradD} style={s.logoBox}>
          <Text style={s.logoMark}>◆</Text>
        </LinearGradient>
        <View style={s.brandBox}>
          <Text style={s.brand}>KARTAVYA</Text>
          <Text style={s.brandSub}>by Aekam Inc</Text>
        </View>
        {rightAction && <View style={s.rightAction}>{rightAction}</View>}
      </View>
      {title ? (
        <View style={s.titleRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color={K.blue} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{title}</Text>
            {subtitle ? <Text style={s.titleSub}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { backgroundColor: K.dark, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,130,198,0.2)' },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox:     { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoMark:    { color: '#fff', fontSize: 13, fontWeight: '900' },
  brandBox:    { flex: 1 },
  brand:       { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  brandSub:    { color: '#05b7aa', fontSize: 7, fontWeight: '700', letterSpacing: 2, marginTop: 1 },
  rightAction: { marginLeft: 'auto' },
  titleRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  backBtn:     { padding: 2, marginRight: 4 },
  title:       { color: '#fff', fontSize: 20, fontWeight: '900' },
  titleSub:    { color: '#8aa5be', fontSize: 12, marginTop: 2 },
});
