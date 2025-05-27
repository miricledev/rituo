import React from 'react';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Platform } from 'react-native';

const STRIPE_PUBLISHABLE_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  android: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  default: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </StripeProvider>
  );
}
