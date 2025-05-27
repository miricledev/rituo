import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, shadows, borderRadius, commonStyles } from '../theme';

const PaymentScreen = () => {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasTasks, setHasTasks] = useState(false);

  useEffect(() => {
    checkTasks();
  }, []);

  const checkTasks = async () => {
    try {
      const response = await fetch('https://rituo-api.onrender.com/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setHasTasks(data.tasks && data.tasks.length > 0);
        if (!data.tasks || data.tasks.length === 0) {
          navigation.replace('CreateTask');
        }
      }
    } catch (err) {
      setError('Could not check tasks');
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create payment intent on backend
      const response = await fetch('https://rituo-api.onrender.com/api/payment/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const { clientSecret } = await response.json();

      // 2. Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Rituo',
      });

      if (initError) {
        setError(initError.message);
        return;
      }

      // 3. Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        setError(presentError.message);
      } else {
        navigation.replace('PaymentSuccess');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasTasks) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.message}>Please create some tasks first!</Text>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={() => navigation.replace('CreateTask')}
          >
            <Text style={styles.buttonText}>Create Tasks</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <Text style={styles.title}>Start Your 30-Day Challenge</Text>
        <Text style={styles.subtitle}>One-time payment of £2.99</Text>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary[500]} />
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={handlePayment}
          >
            <Text style={styles.buttonText}>Complete Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[50],
  },
  contentContainer: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    ...commonStyles.card,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.primary[500],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.h2,
    color: colors.secondary[600],
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  message: {
    ...typography.h3,
    color: colors.secondary[600],
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  button: {
    ...commonStyles.button.primary,
    width: '100%',
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: colors.error.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorText: {
    color: colors.error.text,
    textAlign: 'center',
  },
});

export default PaymentScreen; 