import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './BottomTabNavigator';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { VideoCallScreen } from '../screens/VideoCallScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen
          name="VideoCall"
          component={VideoCallScreen}
          options={{
            animation: 'fade',
            presentation: 'fullScreenModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
