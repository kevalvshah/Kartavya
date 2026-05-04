import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { K, FONT } from '../theme';

export default function KHeader({ title, subtitle, onBack, rightAction }) {
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <View style={s.logoRow}>
          <LinearGradient colors={K.gradD} style={s.logoBox}>
            <Text style={s.logoMark}>◆</Text>
          </LinearGradient>
          <View>
            <Text style={s.brand}>KARTAVYA</Text>
            <Text style={s.sub}>by Aekam Inc</Text>
          </View>
        </View>
        {rightAction && rightAction}
      </View>
      {title ? (
        <View style={s.titleRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={s.back}>
              <Text style={s.backText}>‹</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={s.title}>{title}</Text>
            {subtitle && <Text style={s.titleSub}>{subtitle}</Text>}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { backgroundColor: K.dark, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14 },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox:  { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoMark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  brand:    { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  sub:      { color: K.teal, fontSize: 7, fontWeight: '700', letterSpacing: 2, marginTop: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  back:     { padding: 4 },
  backText: { color: K.blue, fontSize: 28, lineHeight: 28, fontWeight: '300' },
  title:    { color: '#fff', fontSize: 20, ...FONT.black },
  titleSub: { color: K.muted, fontSize: 12, marginTop: 2 },
});
