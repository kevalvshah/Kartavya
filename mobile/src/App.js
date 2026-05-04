import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';
import { K } from './theme';

// Screens
import LoginScreen       from './screens/LoginScreen';
import DashboardScreen   from './screens/DashboardScreen';
import ProjectsScreen    from './screens/ProjectsScreen';
import BoardScreen       from './screens/BoardScreen';
import TasksScreen       from './screens/TasksScreen';
import ProfileScreen     from './screens/ProfileScreen';
import AdminScreen       from './screens/AdminScreen';
import ClientPortalScreen from './screens/ClientPortalScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs({ user, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: K.card,
          borderTopColor: 'rgba(0,130,198,0.3)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: K.blue,
        tabBarInactiveTintColor: K.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Projects:  focused ? 'folder' : 'folder-outline',
            Tasks:     focused ? 'checkmark-circle' : 'checkmark-circle-outline',
            Admin:     focused ? 'shield' : 'shield-outline',
            Profile:   focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'circle'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" children={() => <DashboardScreen />} />
      <Tab.Screen name="Projects"  children={() => <ProjectsScreen />} />
      <Tab.Screen name="Tasks"     children={() => <TasksScreen />} />
      {user?.role === 'admin' && <Tab.Screen name="Admin" children={() => <AdminScreen />} />}
      <Tab.Screen name="Profile"   children={() => <ProfileScreen onLogout={onLogout} />} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);

  const checkAuth = async () => {
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
  };

  useEffect(() => { checkAuth(); }, []);

  const handleLogin = (u) => {
    setUser(u);
    setState(u.role === 'client' ? 'client' : 'app');
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
    setUser(null);
    setState('auth');
  };

  if (state === 'loading') return (
    <View style={{ flex: 1, backgroundColor: K.dark, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: K.blue, fontSize: 26, fontWeight: '900', letterSpacing: 4, marginBottom: 24 }}>KARTAVYA</Text>
      <Text style={{ color: K.teal, fontSize: 9, fontWeight: '700', letterSpacing: 3, marginBottom: 32 }}>BY AEKAM INC</Text>
      <ActivityIndicator color={K.blue} size="large" />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor={K.dark} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {state === 'auth' && (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
            </Stack.Screen>
          )}
          {state === 'app' && (
            <Stack.Screen name="Main">
              {() => <MainTabs user={user} onLogout={handleLogout} />}
            </Stack.Screen>
          )}
          {state === 'client' && (
            <Stack.Screen name="Client">
              {() => <ClientPortalScreen onLogout={handleLogout} />}
            </Stack.Screen>
          )}
          <Stack.Screen name="Board" component={BoardScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
