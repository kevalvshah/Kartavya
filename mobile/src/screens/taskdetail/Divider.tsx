import React from 'react';
import { View } from 'react-native';
import { s } from './styles';

export function Divider({ t }: { t: any }) {
  return <View style={[s.divider, { backgroundColor: t.outline }]} />;
}
