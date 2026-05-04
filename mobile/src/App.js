import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { K } from './theme';

// Screens
import LoginScreen      from './screens/LoginScreen';
import DashboardScreen  from './screens/DashboardScreen';
import ProjectsScreen   from './screens/ProjectsScreen';
import BoardScreen      from './screens/BoardScreen';
import TasksScreen      from './screens/TasksScreen';
import ProfileScreen    from './screens/ProfileScreen';
import AdminScreen      from './screens/AdminScreen';
import ClientPortalScreen from './screens/ClientPortalScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ name, focused }) {
  const icons = {
    Dashboard: focused ? '▣' : '□',
    Projects:  focused ? '⬡' : '⬡',
    Tasks:     focused ? '☑' : '☐',
    Profile:   focused ? '◉' : '○',
    Admin:     focused ? '⚙' : '⚙',
  };
  return (
    <Text style={{ fontSize: 18, color: focused ? K.blue : K.muted }}>
      {icons[name] || '○'}
    </Text>
  );
}

function MainTabs({ user }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: K.card,
          borderTopColor: K.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: K.blue,
        tabBarInactiveTintColor: K.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Projects"  component={ProjectsScreen} />
      <Tab.Screen name="Tasks"     component={TasksScreen} />
      {user?.role === 'admin' && <Tab.Screen name="Admin" component={AdminScreen} />}
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [state, setState] = useState('loading'); // loading | auth | app | client
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) { setState('auth'); return; }
      try {
        const r = await api.get('/auth/me');
        const u = r.data;
        await AsyncStorage.setItem('auth_user', JSON.stringify(u));
        setUser(u);
        setState(u.role === 'client' ? 'client' : 'app');
      } catch {
        await AsyncStorage.removeItem('auth_token');
        setState('auth');
      }
    })();
  }, []);

  if (state === 'loading') return (
    <View style={{ flex:1, backgroundColor: K.dark, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color: K.blue, fontSize: 22, fontWeight: '900', letterSpacing: 4 }}>KARTAVYA</Text>
      <ActivityIndicator color={K.blue} style={{ marginTop: 20 }} />
    </View>
  );

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={K.dark} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state === 'auth'   && <Stack.Screen name="Login" component={LoginScreen} initialParams={{ onLogin: (u) => { setUser(u); setState(u.role === 'client' ? 'client' : 'app'); }}} />}
        {state === 'app'    && <Stack.Screen name="Main"  children={() => <MainTabs user={user} />} />}
        {state === 'client' && <Stack.Screen name="Client" component={ClientPortalScreen} />}
        <Stack.Screen name="Board" component={BoardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
