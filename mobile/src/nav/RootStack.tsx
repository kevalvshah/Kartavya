import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { linking } from './linking';
import { navigationRef } from './navigationRef';

// ── Screens ──────────────────────────────────────────────────────────────────
// Phase-1 stubs; replaced in Phase 2
import TodayScreen       from '../screens/TodayScreen';
import SettingsScreen    from '../screens/SettingsScreen';
import BoardsScreen     from '../screens/BoardsScreen';
import InboxScreen      from '../screens/InboxScreen';
import MeScreen         from '../screens/MeScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import BoardScreen      from '../screens/BoardScreen';
import LoginScreen      from '../screens/LoginScreen';
import ClientPortalScreen from '../screens/ClientPortalScreen';
import { useAuth } from '../hooks/useAuth';

// ── Param lists ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Main:         undefined;
  TaskDetail:   { taskId: string };
  Board:        { projectId: string; projectName: string };
  Settings:     undefined;
  Login:        undefined;
  Client:       undefined;
};

export type MainTabParamList = {
  Today:  undefined;
  Boards: undefined;
  Add:    undefined;   // centre pill — no screen, triggers sheet
  Inbox:  undefined;
  Me:     undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<MainTabParamList>();

// ── Centre "+" tab button ─────────────────────────────────────────────────────
function AddButton({ onPress }: { onPress: () => void }) {
  const { t } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.addWrap}>
      <LinearGradient
        colors={['#0082c6', '#03a1b6', '#05b7aa']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.addPill}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Main tabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  const { t, scheme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: Platform.OS === 'ios' ? {
          // iOS: Liquid Glass — translucent with blur
          position:          'absolute',
          backgroundColor:   t.tabBg,
          borderTopColor:    'rgba(60,60,67,0.18)',
          borderTopWidth:    0.5,
          height:            84,
          paddingBottom:     24,
          paddingTop:        8,
        } : {
          // Android: M3 surface
          backgroundColor: t.surface,
          borderTopColor:  t.outline,
          borderTopWidth:  1,
          height:          64,
          paddingBottom:   8,
          paddingTop:      8,
          elevation:       4,
        },
        tabBarBackground: Platform.OS === 'ios' ? () => (
          // Expo doesn't support native blur for tab bar; use semi-transparent surface
          // For real blur: use @react-native-community/blur or expo-blur
          <View style={{
            flex: 1,
            backgroundColor: t.tabBg,
          }} />
        ) : undefined,
        tabBarActiveTintColor:   t.primary,
        tabBarInactiveTintColor: t.ink3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarIcon: ({ focused, color }) => {
          if (route.name === 'Add') return null; // custom button handles this
          const map: Record<string, [string, string]> = {
            Today:  ['today',               'today-outline'],
            Boards: ['grid',                'grid-outline'],
            Inbox:  ['notifications',       'notifications-outline'],
            Me:     ['person-circle',       'person-circle-outline'],
          };
          const [active, inactive] = map[route.name] || ['circle', 'circle-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Today"  component={TodayScreen}  options={{ title: 'Today' }} />
      <Tab.Screen name="Boards" component={BoardsScreen} options={{ title: 'Boards' }} />
      <Tab.Screen
        name="Add"
        component={TodayScreen}   // never actually rendered
        options={{
          title: '',
          tabBarButton: (props) => (
            <AddButton onPress={() => {
              // TODO Phase 2: open new-task sheet
              console.log('open new-task sheet');
            }} />
          ),
        }}
      />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }} />
      <Tab.Screen name="Me"    component={MeScreen}    options={{ title: 'Me' }} />
    </Tab.Navigator>
  );
}

// ── Root navigator ─────────────────────────────────────────────────────────────
export default function RootStack() {
  const { user, loading } = useAuth();
  const { t, scheme }     = useTheme();

  if (loading) return null; // App.tsx renders splash

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={{
        dark: scheme === 'dark',
        colors: {
          primary:    t.primary,
          background: t.bg,
          card:       t.surface,
          text:       t.ink,
          border:     t.outline,
          notification: t.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login"  component={LoginScreen} />
        ) : user.role === 'client' ? (
          <Stack.Screen name="Client" component={ClientPortalScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"       component={MainTabs} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen}
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Board"     component={BoardScreen} />
            <Stack.Screen name="Settings"  component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  addWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  addPill: {
    width:        56,
    height:       56,
    borderRadius: 28,
    alignItems:   'center',
    justifyContent: 'center',
    shadowColor:  '#0082c6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius:  8,
    elevation:    8,
  },
});
