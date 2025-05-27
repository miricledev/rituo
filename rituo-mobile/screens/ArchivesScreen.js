import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BarChart, PieChart, LineChart, RadarChart } from 'react-native-chart-kit';
import { colors, spacing, typography, borderRadius, commonStyles } from '../theme';

const screenWidth = Dimensions.get('window').width - spacing.lg * 2;

const ArchivesScreen = () => {
  const navigation = useNavigation();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      // Replace with your API endpoint and auth as needed
      const response = await fetch('https://rituo-api.onrender.com/api/analytics/archives');
      const data = await response.json();
      if (response.ok) {
        setArchives(data.archives || []);
      } else {
        setArchives([]);
      }
    } catch (err) {
      setArchives([]);
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

  if (!archives.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⏳</Text>
        <Text style={styles.emptyTitle}>No Completed Challenges Yet</Text>
        <Text style={styles.emptyText}>Complete a 30-day challenge to see your achievements and analytics here!</Text>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => navigation.navigate('Dashboard')}>
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Helper for radar chart data
  const getRadarData = (tasks) => {
    return tasks.map((task, i) => ({
      name: task.title.length > 10 ? task.title.slice(0, 10) + '…' : task.title,
      value: Number(task.completion_rate),
      color: chartColors[i % chartColors.length],
    }));
  };

  // Chart colors
  const chartColors = [colors.primary[500], colors.success.text, colors.error.text, colors.secondary[500], colors.primary[700], colors.secondary[700]];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Archives: Completed 30-Day Challenges</Text>
      {archives.map((archive, idx) => {
        // Bar chart data
        const barData = {
          labels: archive.tasks.map(t => t.title.length > 8 ? t.title.slice(0, 8) + '…' : t.title),
          datasets: [
            {
              data: archive.tasks.map(t => Number(t.completion_rate)),
            },
          ],
        };
        // Pie chart data
        const pieData = archive.tasks.map((t, i) => ({
          name: t.title.length > 10 ? t.title.slice(0, 10) + '…' : t.title,
          population: Number(t.completion_rate),
          color: chartColors[i % chartColors.length],
          legendFontColor: colors.secondary[800],
          legendFontSize: 12,
        }));
        // Line chart data
        const lineData = {
          labels: (archive.daily_data || []).map(d => new Date(d.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })),
          datasets: [
            {
              data: (archive.daily_data || []).map(d => d.is_complete ? 1 : 0),
              color: () => colors.success.text,
              strokeWidth: 2,
            },
          ],
        };
        // Radar chart data
        const radarData = getRadarData(archive.tasks);
        return (
          <View key={archive.cycle_id || idx} style={styles.archiveCard}>
            <View style={styles.archiveHeader}>
              <View>
                <Text style={styles.archiveTitle}>{archive.title || `Challenge #${idx + 1}`}</Text>
                <Text style={styles.archiveDates}>{archive.cycle_start_date} - {archive.cycle_end_date}</Text>
              </View>
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            </View>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{archive.days_completed}</Text>
                <Text style={styles.statsLabel}>Days Completed</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{archive.completion_rate?.toFixed(1)}%</Text>
                <Text style={styles.statsLabel}>Completion Rate</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{archive.current_streak}</Text>
                <Text style={styles.statsLabel}>Longest Streak</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{archive.tasks.length}</Text>
                <Text style={styles.statsLabel}>Tasks</Text>
              </View>
            </View>
            {/* Bar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Task Completion</Text>
              <BarChart
                data={barData}
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
            {/* Pie Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Task Distribution</Text>
              <PieChart
                data={pieData}
                width={screenWidth}
                height={180}
                chartConfig={{
                  backgroundColor: colors.secondary[100],
                  backgroundGradientFrom: colors.secondary[100],
                  backgroundGradientTo: colors.secondary[100],
                  color: (opacity = 1) => colors.primary[500],
                  labelColor: (opacity = 1) => colors.secondary[600],
                }}
                accessor="population"
                backgroundColor={colors.secondary[100]}
                paddingLeft={0}
                absolute
                style={styles.chart}
              />
            </View>
            {/* Line Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Daily Completion History</Text>
              <LineChart
                data={lineData}
                width={screenWidth}
                height={180}
                yLabelsOffset={8}
                fromZero
                chartConfig={{
                  backgroundColor: colors.secondary[100],
                  backgroundGradientFrom: colors.secondary[100],
                  backgroundGradientTo: colors.secondary[100],
                  decimalPlaces: 0,
                  color: (opacity = 1) => colors.success.text,
                  labelColor: (opacity = 1) => colors.secondary[600],
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: colors.success.text,
                  },
                }}
                bezier
                style={styles.chart}
                withInnerLines={false}
                withOuterLines={false}
                segments={2}
                formatYLabel={y => (y === '1' ? 'Completed' : 'Missed')}
              />
            </View>
            {/* Radar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Task Strengths</Text>
              <RadarChart
                data={radarData}
                width={screenWidth}
                height={180}
                chartConfig={{
                  backgroundColor: colors.secondary[100],
                  backgroundGradientFrom: colors.secondary[100],
                  backgroundGradientTo: colors.secondary[100],
                  decimalPlaces: 0,
                  color: (opacity = 1) => colors.primary[500],
                  labelColor: (opacity = 1) => colors.secondary[600],
                }}
                style={styles.chart}
              />
            </View>
            {/* Task list */}
            <View style={styles.taskListCard}>
              <Text style={styles.taskListTitle}>Tasks</Text>
              {archive.tasks.map((task, i) => (
                <View key={i} style={styles.taskRow}>
                  <Text style={styles.taskName}>{task.title}</Text>
                  <Text style={styles.taskPercent}>{Number(task.completion_rate).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
    color: colors.primary[300],
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.secondary[900],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.secondary[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.secondary[900],
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  archiveCard: {
    ...commonStyles.card,
    marginBottom: spacing.xl,
  },
  archiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  archiveTitle: {
    ...typography.h2,
    color: colors.primary[600],
  },
  archiveDates: {
    ...typography.body,
    color: colors.secondary[600],
  },
  completedBadge: {
    backgroundColor: colors.success.light,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  completedBadgeText: {
    color: colors.success.text,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statsCard: {
    flex: 1,
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  statsValue: {
    ...typography.h2,
    color: colors.primary[600],
  },
  statsLabel: {
    ...typography.caption,
    color: colors.secondary[600],
    textAlign: 'center',
  },
  chartCard: {
    flex: 1,
    backgroundColor: colors.secondary[100],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  chartTitle: {
    ...typography.body,
    color: colors.secondary[800],
    marginBottom: spacing.sm,
    fontWeight: 'bold',
  },
  chart: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.secondary[100],
    paddingRight: 0,
  },
  taskListCard: {
    marginTop: spacing.lg,
  },
  taskListTitle: {
    ...typography.h3,
    color: colors.secondary[900],
    marginBottom: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary[200],
  },
  taskName: {
    ...typography.body,
    color: colors.secondary[800],
  },
  taskPercent: {
    ...typography.caption,
    color: colors.primary[600],
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
});

export default ArchivesScreen; 