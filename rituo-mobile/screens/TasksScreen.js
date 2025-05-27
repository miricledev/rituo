import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Button, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function TasksScreen({ navigation }) {
  const { token, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://rituo-api.onrender.com/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || []);
      } else {
        setError(data.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Could not connect to server');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!token) return;
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleTaskCompletion = async (taskId) => {
    setTogglingId(taskId);
    try {
      const response = await fetch(`https://rituo-api.onrender.com/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await response.json();
      // Refresh tasks
      await fetchTasks();
    } catch (err) {
      // Optionally show error
    }
    setTogglingId(null);
  };

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Retry" onPress={fetchTasks} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Tasks</Text>
      <Button title="Create New Task" onPress={() => navigation.navigate('CreateTask')} />
      <View style={{ height: 16 }} />
      {tasks.length === 0 ? (
        <Text style={styles.subtitle}>No tasks found.</Text>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item.id?.toString() || item.title}
          renderItem={({ item }) => (
            <View style={styles.taskItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={item.is_complete_today ? styles.complete : styles.incomplete}>
                  {item.is_complete_today ? 'Complete' : 'Incomplete'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => toggleTaskCompletion(item.id)}
                disabled={togglingId === item.id}
              >
                {togglingId === item.id ? (
                  <ActivityIndicator size="small" color="#0ea5e9" />
                ) : (
                  <Text style={styles.toggleBtnText}>
                    {item.is_complete_today ? 'Mark Incomplete' : 'Mark Complete'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#0ea5e9' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 16 },
  error: { color: 'red', marginBottom: 16, textAlign: 'center' },
  taskItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  taskTitle: { fontSize: 16, color: '#222' },
  complete: { color: 'green', fontWeight: 'bold' },
  incomplete: { color: 'orange', fontWeight: 'bold' },
  toggleBtn: { backgroundColor: '#0ea5e9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleBtnText: { color: '#fff', fontWeight: 'bold' },
}); 