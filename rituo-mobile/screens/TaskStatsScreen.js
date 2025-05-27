import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, commonStyles } from '../theme';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width - spacing.lg * 2;

const TaskStatsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params;
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTaskStats();
  }, [taskId]);

  const fetchTaskStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`https://rituo-api.onrender.com/api/tasks/${taskId}/stats`);
      const data = await response.json();
      if (response.ok) {
        setTaskData(data);
        setError('');
      } else {
        setError(data.message || 'Failed to load task data.');
      }
    } catch (err) {
      setError('Failed to load task data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (error || !taskData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Task not found. Please go back to the dashboard and try again.'}</Text>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prepare chart data
  const chartData = (taskData.daily_data || []).map(day => ({
    date: new Date(day.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    completed: day.is_complete ? 1 : 0,
    originalDate: day.date
  })).sort((a, b) => new Date(a.originalDate) - new Date(b.originalDate));

  const lineChartData = {
    labels: chartData.map(d => d.date),
    datasets: [
      {
        data: chartData.map(d => d.completed),
        color: () => colors.primary[500],
        strokeWidth: 2,
      },
    ],
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Statistics</Text>
      </View>
      <Text style={styles.taskTitle}>{taskData.task.title}</Text>

      {/* Overview cards */}
      <View style={styles.overviewRow}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{taskData.days_completed}</Text>
          <Text style={styles.overviewLabel}>Days Completed</Text>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{Math.round(taskData.completion_rate)}%</Text>
          <Text style={styles.overviewLabel}>Completion Rate</Text>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{taskData.current_streak}</Text>
          <Text style={styles.overviewLabel}>Current Streak</Text>
        </View>
      </View>
      {taskData.task.description ? (
        <View style={styles.descCard}>
          <Text style={styles.descLabel}>Description:</Text>
          <Text style={styles.descText}>{taskData.task.description}</Text>
        </View>
      ) : null}

      {/* Progress bar */}
      <View style={styles.progressBarSection}>
        <View style={styles.progressBarLabelRow}>
          <Text style={styles.progressBarLabel}>Overall Progress</Text>
          <Text style={styles.progressBarLabel}>{Math.round(taskData.completion_rate)}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${taskData.completion_rate}%` }]} />
        </View>
      </View>

      {/* Line Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Daily Completion History</Text>
        <LineChart
          data={lineChartData}
          width={screenWidth}
          height={200}
          yLabelsOffset={8}
          yAxisLabel={''}
          yAxisSuffix={''}
          yAxisInterval={1}
          fromZero
          chartConfig={{
            backgroundColor: colors.secondary[100],
            backgroundGradientFrom: colors.secondary[100],
            backgroundGradientTo: colors.secondary[100],
            decimalPlaces: 0,
            color: (opacity = 1) => colors.primary[500],
            labelColor: (opacity = 1) => colors.secondary[600],
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: colors.primary[500],
            },
          }}
          bezier
          style={styles.lineChart}
          withInnerLines={false}
          withOuterLines={false}
          segments={2}
          formatYLabel={y => (y === '1' ? 'Completed' : 'Missed')}
        />
      </View>

      {/* Completion log */}
      <View style={styles.logCard}>
        <Text style={styles.logTitle}>Completion Log</Text>
        <FlatList
          data={taskData.daily_data}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <View style={styles.logRow}>
              <Text style={styles.logDate}>{new Date(item.date).toLocaleDateString()}</Text>
              <View style={[styles.statusBadge, item.is_complete ? styles.statusComplete : styles.statusMissed]}>
                <Text style={item.is_complete ? styles.statusCompleteText : styles.statusMissedText}>
                  {item.is_complete ? 'Completed' : 'Missed'}
                </Text>
              </View>
            </View>
          )}
        />
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
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.sm,
  },
  backButtonText: {
    color: colors.primary[500],
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.secondary[900],
    flex: 1,
  },
  taskTitle: {
    ...typography.h3,
    color: colors.primary[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  overviewValue: {
    ...typography.h2,
    color: colors.primary[600],
  },
  overviewLabel: {
    ...typography.caption,
    color: colors.secondary[600],
    textAlign: 'center',
  },
  descCard: {
    backgroundColor: colors.secondary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  descLabel: {
    ...typography.body,
    fontWeight: 'bold',
    color: colors.secondary[800],
    marginBottom: spacing.xs,
  },
  descText: {
    ...typography.body,
    color: colors.secondary[700],
  },
  progressBarSection: {
    marginBottom: spacing.lg,
  },
  progressBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressBarLabel: {
    ...typography.caption,
    color: colors.secondary[600],
  },
  progressBarBg: {
    height: 12,
    backgroundColor: colors.secondary[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 12,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  chartCard: {
    ...commonStyles.card,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    ...typography.h3,
    color: colors.secondary[900],
    marginBottom: spacing.md,
  },
  lineChart: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.secondary[100],
    paddingRight: 0,
  },
  logCard: {
    ...commonStyles.card,
    marginBottom: spacing.lg,
  },
  logTitle: {
    ...typography.h3,
    color: colors.secondary[900],
    marginBottom: spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary[200],
  },
  logDate: {
    ...typography.body,
    color: colors.secondary[700],
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusComplete: {
    backgroundColor: colors.success.light,
  },
  statusMissed: {
    backgroundColor: colors.error.light,
  },
  statusCompleteText: {
    color: colors.success.text,
    fontWeight: 'bold',
  },
  statusMissedText: {
    color: colors.error.text,
    fontWeight: 'bold',
  },
  button: {
    ...commonStyles.button.primary,
    marginTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: 'bold',
  },
  errorText: {
    color: colors.error.text,
    backgroundColor: colors.error.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});

export default TaskStatsScreen; 