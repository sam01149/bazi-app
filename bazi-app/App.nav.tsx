import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from './src/screens/OnboardingScreen';
import ChartScreen from './src/screens/ChartScreen';
import CalendarScreen from './src/screens/CalendarScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Onboarding">
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingScreen} 
            options={{ title: 'BaZi - Mulai' }} 
          />
          <Stack.Screen 
            name="Chart" 
            component={ChartScreen} 
            options={{ title: 'BaZi Chart' }} 
          />
          <Stack.Screen 
            name="Calendar" 
            component={CalendarScreen} 
            options={{ title: 'Kalender BaZi' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
