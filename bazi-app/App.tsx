import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';

import { ChartProvider } from './src/context/ChartContext';
import CalendarScreen from './src/screens/CalendarScreen';
import WishScreen from './src/screens/WishScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const C = {
  bgDeep: '#070F2B',
  bgCard: '#0D1F4E',
  border: '#1E3A80',
  gold:   '#F8D21B',
  muted:  '#8BAAD4',
  white:  '#FFFFFF',
};

const TAB_ICONS: Record<string, string> = {
  Kalender: '📅',
  Keinginan: '✨',
  Profil: '☯',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ChartProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerStyle: { backgroundColor: C.bgDeep },
              headerTintColor: C.white,
              headerTitleStyle: { fontWeight: '800' },
              tabBarStyle: {
                backgroundColor: C.bgCard,
                borderTopColor: C.border,
                borderTopWidth: 1,
                height: 64,
                paddingBottom: 8,
              },
              tabBarActiveTintColor: C.gold,
              tabBarInactiveTintColor: C.muted,
              tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: size - 4, color }}>{TAB_ICONS[route.name] ?? '◉'}</Text>
              ),
            })}
          >
            <Tab.Screen
              name="Kalender"
              component={CalendarScreen}
              options={{ title: 'Kalender BaZi' }}
            />
            <Tab.Screen
              name="Keinginan"
              component={WishScreen}
              options={{ title: 'Keinginanku' }}
            />
            <Tab.Screen
              name="Profil"
              component={ProfileScreen}
              options={{ title: 'Profil BaZi' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </ChartProvider>
    </SafeAreaProvider>
  );
}
