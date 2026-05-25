import React from 'react';
import { View, Text } from 'react-native';
import { avatarColor, userInitials } from '../../theme/tokens';

export function Avatar({ uid, name, size = 28 }: { uid: string; name: string; size?: number }) {
  const bg = avatarColor(uid);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>{userInitials(name)}</Text>
    </View>
  );
}
