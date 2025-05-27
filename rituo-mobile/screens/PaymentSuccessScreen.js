import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function PaymentSuccessScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.checkmark}>✓</Text>
      </View>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.subtitle}>Your 30-day challenge has been activated.</Text>
      <Button title="Go to Dashboard" onPress={() => navigation.replace('Dashboard')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  iconContainer: { backgroundColor: '#d1fae5', borderRadius: 50, padding: 24, marginBottom: 24 },
  checkmark: { fontSize: 48, color: '#10b981', fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, color: '#0ea5e9', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 32, textAlign: 'center' },
}); 