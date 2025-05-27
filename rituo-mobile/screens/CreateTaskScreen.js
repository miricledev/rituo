import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function CreateTaskScreen({ navigation }) {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateTask = async () => {
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://rituo-api.onrender.com/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tasks: [{ title, description }],
        }),
      });
      const data = await response.json();
      if (response.ok) {
        navigation.replace('Tasks');
      } else {
        setError(data.message || 'Failed to create task');
      }
    } catch (err) {
      setError('Could not connect to server');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Task</Text>
      <TextInput
        style={styles.input}
        placeholder="Task Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator size="large" color="#0ea5e9" />
      ) : (
        <Button title="Create Task" onPress={handleCreateTask} />
      )}
      <View style={{ height: 16 }} />
      <Button title="Back to Tasks" onPress={() => navigation.replace('Tasks')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#0ea5e9', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: '#fafafa' },
  error: { color: 'red', marginBottom: 12, textAlign: 'center' },
}); 