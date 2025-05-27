import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList, SafeAreaView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { BarChart } from 'react-native-chart-kit';
import { colors, spacing, typography, shadows, borderRadius, commonStyles } from '../theme';

const screenWidth = Dimensions.get('window').width - spacing.lg * 2;

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user, token, logout, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    completionRate: 0,
    currentStreak: 0,
    totalCompleted: 0
  });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Fetch tasks only when auth is loaded and token is available
  useEffect(() => {
    if (!authLoading && token) {
      fetchTasks();
      fetchAnalytics();
    }
  }, [authLoading, token]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://rituo-api.onrender.com/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || []);
        // Calculate stats
        const completed = data.tasks.filter(t => t.is_complete_today).length;
        const total = data.tasks.length;
        setStats({
          completionRate: total ? (completed / total) * 100 : 0,
          currentStreak: data.current_streak || 0,
          totalCompleted: completed
        });
      } else {
        setError(data.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const response = await fetch('https://rituo-api.onrender.com/api/analytics/summary', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      console.log('Analytics API raw response:', response);
      const data = await response.json();
      console.log('Analytics API parsed data:', data);
      if (response.ok) {
        setAnalytics(data);
      } else {
        setAnalytics(null);
        setAnalyticsError(data.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      setAnalytics(null);
      setAnalyticsError('Could not connect to analytics server');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const toggleTaskCompletion = async (taskId) => {
    try {
      const response = await fetch(`https://rituo-api.onrender.com/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        fetchTasks();
        fetchAnalytics();
      }
    } catch (err) {
      setError('Failed to update task');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!user) {
    navigation.replace('Login');
    return null;
  }

  // Add error output to UI
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (analyticsError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{analyticsError}</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If no tasks and no analytics, show a message
  if ((!tasks || tasks.length === 0) && !analytics) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No tasks or analytics data available.</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prepare bar chart data if analytics is available
  let dailyBarData = null;
  let weeklyBarData = null;
  if (analytics && analytics.daily_performance) {
    dailyBarData = {
      labels: analytics.daily_performance.map(d => d.label),
      datasets: [
        {
          data: analytics.daily_performance.map(d => d.completion_rate),
        },
      ],
    };
  }
  if (analytics && analytics.weekly_performance) {
    weeklyBarData = {
      labels: analytics.weekly_performance.map(d => d.label),
      datasets: [
        {
          data: analytics.weekly_performance.map(d => d.completion_rate),
        },
      ],
    };
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with sign out */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>
            Welcome back, {user.username}! Track your daily progress and stay committed.
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Main content */}
        <View style={styles.content}>
          {/* Task list */}
          <Text style={styles.toggleInstruction}>Tap a task to toggle complete/incomplete.</Text>
          <View style={styles.taskSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your 30-Day Tasks</Text>
            </View>
            {tasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No tasks yet. Create your first task to begin!</Text>
              </View>
            ) : (
              <FlatList
                data={tasks}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.taskItem}
                    onPress={() => toggleTaskCompletion(item.id)}
                  >
                    <View style={styles.taskContent}>
                      <Text style={styles.taskTitle}>{item.title}</Text>
                      <Text style={[
                        styles.taskStatus,
                        item.is_complete_today ? styles.completed : styles.incomplete
                      ]}>
                        {item.is_complete_today ? 'Complete' : 'Incomplete'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>Today's Progress</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.completionRate.toFixed(0)}%</Text>
                  <Text style={styles.statLabel}>Completion Rate</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.currentStreak}</Text>
                  <Text style={styles.statLabel}>Current Streak</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.totalCompleted}</Text>
                  <Text style={styles.statLabel}>Completed Today</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Performance Bar Charts */}
          {analyticsLoading ? (
            <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginVertical: spacing.lg }} />
          ) : (
            <>
              {console.log('Analytics state:', analytics)}
              {analytics && analytics.daily_performance && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Daily Performance (Last 7 Days)</Text>
                  <BarChart
                    data={dailyBarData}
                    width={screenWidth}
                    height={180}
                    yAxisSuffix="%"
                    fromZero
                    chartConfig={{
                      backgroundColor: colors.secondary[100],
                      backgroundGradientFrom: colors.secondary[100],
                      backgroundGradientTo: colors.secondary[100],
                      decimalPlaces: 0,
                      color: (opacity = 1) => colors.primary[500],
                      labelColor: (opacity = 1) => colors.secondary[600],
                      barPercentage: 0.6,
                    }}
                    style={styles.chart}
                    showValuesOnTopOfBars
                  />
                </View>
              )}
              {analytics && analytics.weekly_performance && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Weekly Performance (Last 4 Weeks)</Text>
                  <BarChart
                    data={weeklyBarData}
                    width={screenWidth}
                    height={180}
                    yAxisSuffix="%"
                    fromZero
                    chartConfig={{
                      backgroundColor: colors.secondary[100],
                      backgroundGradientFrom: colors.secondary[100],
                      backgroundGradientTo: colors.secondary[100],
                      decimalPlaces: 0,
                      color: (opacity = 1) => colors.primary[500],
                      labelColor: (opacity = 1) => colors.secondary[600],
                      barPercentage: 0.6,
                    }}
                    style={styles.chart}
                    showValuesOnTopOfBars
                  />
                </View>
              )}
            </>
          )}

          {/* Motivation section */}
          <View style={styles.motivationSection}>
            <Text style={styles.motivationTitle}>Daily Inspiration</Text>
            <Text style={styles.quote}>
              "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
            </Text>
            <Text style={styles.quoteAuthor}>— Aristotle</Text>
          </View>
        </View>
      </ScrollView>
      {/* Sticky Create Tasks button if no tasks */}
      {tasks.length === 0 && (
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate('CreateTask')}
          >
            <Text style={styles.buttonText}>Create Tasks</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.primary[50],
  },
  title: {
    ...typography.h1,
    color: colors.secondary[900],
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondary[600],
  },
  content: {
    padding: spacing.lg,
  },
  taskSection: {
    ...commonStyles.card,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.secondary[800],
  },
  taskItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary[200],
  },
  taskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: {
    ...typography.body,
    color: colors.secondary[800],
    flex: 1,
  },
  taskStatus: {
    ...typography.caption,
    fontWeight: 'bold',
  },
  completed: {
    color: colors.success.text,
  },
  incomplete: {
    color: colors.secondary[500],
  },
  statsSection: {
    gap: spacing.lg,
  },
  statsCard: {
    ...commonStyles.card,
  },
  statsTitle: {
    ...typography.h3,
    color: colors.secondary[800],
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.primary[500],
  },
  statLabel: {
    ...typography.caption,
    color: colors.secondary[600],
    textAlign: 'center',
  },
  ctaCard: {
    ...commonStyles.card,
    alignItems: 'center',
  },
  ctaTitle: {
    ...typography.h3,
    color: colors.secondary[900],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  ctaText: {
    ...typography.body,
    color: colors.secondary[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  button: {
    ...commonStyles.button.primary,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    ...typography.body,
    color: colors.secondary[600],
    textAlign: 'center',
  },
  motivationSection: {
    ...commonStyles.card,
    margin: spacing.lg,
  },
  motivationTitle: {
    ...typography.h3,
    color: colors.secondary[900],
    marginBottom: spacing.sm,
  },
  quote: {
    ...typography.body,
    color: colors.secondary[700],
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  quoteAuthor: {
    ...typography.caption,
    color: colors.secondary[600],
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.secondary[600],
    marginBottom: spacing.lg,
  },
  signOutButton: {
    ...commonStyles.button.primary,
    padding: spacing.md,
  },
  signOutText: {
    ...typography.body,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
});

export default DashboardScreen; 