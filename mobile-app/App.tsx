import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, View, StatusBar, SafeAreaView, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts
import { SupabaseProvider } from './src/contexts/SupabaseContext';
import { AuthProvider } from './src/contexts/AuthContext';

// Screens
import { HomeScreen } from './src/screens/HomeScreen';
import { NewslettersScreen } from './src/screens/NewslettersScreen';

// Types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Define the type for the navigation stack
type RootStackParamList = {
  Home: undefined;
  Newsletters: undefined;
};

const Tab = createBottomTabNavigator<RootStackParamList>();

// Initialize query client
const queryClient = new QueryClient();

// Tab bar icon component
const TabBarIcon = ({ focused, color, size, name }: { 
  focused: boolean; 
  color: string; 
  size: number; 
  name: string 
}) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color, fontSize: size }}>{name}</Text>
  </View>
);

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <QueryClientProvider client={queryClient}>
          <SupabaseProvider>
            <AuthProvider>
              <NavigationContainer>
                <Tab.Navigator
                  screenOptions={({ route }) => ({
                    tabBarIcon: ({ focused, color, size }) => {
                      let iconName = '❓';

                      if (route.name === 'Home') {
                        iconName = '🏠';
                      } else if (route.name === 'Newsletters') {
                        iconName = '📰';
                      }

                      return <TabBarIcon focused={focused} color={color} size={size} name={iconName} />;
                    },
                    tabBarActiveTintColor: '#2563eb',
                    tabBarInactiveTintColor: 'gray',
                    headerShown: false,
                    tabBarStyle: {
                      backgroundColor: '#ffffff',
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: '#e5e7eb',
                    },
                    tabBarLabelStyle: {
                      fontSize: 12,
                      fontWeight: '500',
                    },
                  })}
                >
                  <Tab.Screen 
                    name="Home" 
                    component={HomeScreen} 
                    options={{
                      title: 'Home',
                    }}
                  />
                  <Tab.Screen 
                    name="Newsletters" 
                    component={NewslettersScreen}
                    options={{
                      title: 'Newsletters',
                    }}
                  />
                </Tab.Navigator>
              </NavigationContainer>
            </AuthProvider>
          </SupabaseProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
