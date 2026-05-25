import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from './styles';

interface Props {
  label:     string;
  t:         any;
  children:  React.ReactNode;
  action?:   { icon: string; onPress: () => void };
}

export function Section({ label, t, children, action }: Props) {
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
