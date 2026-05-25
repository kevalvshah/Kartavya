import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from './styles';

interface Props {
  onBack:        () => void;
  title:         string;
  t:             any;
  rightActions?: React.ReactNode;
}

export function SafeHeader({ onBack, title, t, rightActions }: Props) {
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
