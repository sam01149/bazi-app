import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

import { ChartProvider } from './src/context/ChartContext';
import CalendarScreen from './src/screens/CalendarScreen';
import WishScreen from './src/screens/WishScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { C } from './src/theme';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Kalender',  label: 'Kalender',   icon: '⊞', component: CalendarScreen },
  { name: 'Keinginan', label: 'Keinginan',  icon: '✦', component: WishScreen    },
  { name: 'Profil',    label: 'Profil',     icon: '◉', component: ProfileScreen  },
];

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}>
      <Text style={{
        fontSize: 18,
        color: focused ? C.gold : C.textFaint,
        lineHeight: 22,
      }}>
        {icon}
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ChartProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => {
              const tab = TAB_CONFIG.find(t => t.name === route.name);
              return {
                headerStyle:      { backgroundColor: C.bg, shadowColor: 'transparent', elevation: 0 },
                headerTintColor:  C.text,
                headerTitleStyle: { fontWeight: '800', fontSize: 17, color: C.text },
                headerShadowVisible: false,
                tabBarStyle: {
                  backgroundColor: C.surface,
                  borderTopColor:  C.border,
                  borderTopWidth:  1,
                  height:          60,
                  paddingBottom:   8,
                  paddingTop:      4,
                },
                tabBarActiveTintColor:   C.gold,
                tabBarInactiveTintColor: C.textFaint,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
                tabBarIcon: ({ focused }) => <TabIcon icon={tab?.icon ?? '·'} focused={focused} />,
              };
            }}
          >
            {TAB_CONFIG.map(tab => (
              <Tab.Screen
                key={tab.name}
                name={tab.name}
                component={tab.component}
                options={{ title: tab.label }}
              />
            ))}
          </Tab.Navigator>
        </NavigationContainer>
      </ChartProvider>
    </SafeAreaProvider>
  );
}
