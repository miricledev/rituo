import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, CheckBox } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useStripe } from '@stripe/stripe-react-native';
import { colors, spacing, typography, borderRadius, commonStyles } from '../theme';

const TIPS = [
  'Start with manageable tasks that you can realistically complete daily',
  'Be specific about what counts as completing each task',
  'Consider including a mix of physical, mental, and personal growth activities',
  'Remember, these tasks will reset daily for 30 days',
];

const CreateTasksScreen = () => {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [tasks, setTasks] = useState([{ title: '', description: '' }]);
  const [activeStep, setActiveStep] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add new empty task
  const addTask = () => {
    if (tasks.length < 10) {
      setTasks([...tasks, { title: '', description: '' }]);
    }
  };

  // Remove a task
  const removeTask = (index) => {
    if (tasks.length > 1) {
      const updatedTasks = [...tasks];
      updatedTasks.splice(index, 1);
      setTasks(updatedTasks);
    }
  };

  // Handle task input change
  const handleTaskChange = (index, field, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[index][field] = value;
    setTasks(updatedTasks);
  };

  // Move to next step
  const nextStep = () => {
    if (activeStep === 1) {
      const emptyTasks = tasks.filter(task => !task.title.trim());
      if (emptyTasks.length > 0) {
        setError('All tasks must have a title. Please fill in all required fields.');
        return;
      }
      setError('');
    }
    setActiveStep(activeStep + 1);
  };

  // Move to previous step
  const prevStep = () => {
    setActiveStep(activeStep - 1);
  };

  // Handle payment and create tasks
  const handlePaymentAndCreate = async () => {
    if (!accepted) {
      setError('You must acknowledge the 30-day commitment to continue.');
      return;
    }
    setLoading(true);
    setError('');
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
        setLoading(false);
        return;
      }
      // 3. Present payment sheet
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        setError(presentError.message);
        setLoading(false);
        return;
      }
      // 4. Create tasks on backend
      const validTasks = tasks.filter(task => task.title.trim());
      const createRes = await fetch('https://rituo-api.onrender.com/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tasks: validTasks }),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.message || 'Failed to create tasks. Please try again.');
        setLoading(false);
        return;
      }
      navigation.replace('Dashboard');
    } catch (e) {
      setError(e.message || 'Failed to process payment or create tasks.');
    } finally {
      setLoading(false);
    }
  };

  // Step progress bar
  const renderProgress = () => (
    <View style={styles.progressBarContainer}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[styles.progressBar, activeStep >= step ? styles.progressActive : styles.progressInactive]}
        />
      ))}
    </View>
  );

  // Step 1: Create tasks
  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Step 1: Create Your Tasks</Text>
      {tasks.map((task, index) => (
        <View key={index} style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskLabel}>Task {index + 1}</Text>
            {tasks.length > 1 && (
              <TouchableOpacity onPress={() => removeTask(index)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Task Title *"
            value={task.title}
            onChangeText={text => handleTaskChange(index, 'title', text)}
          />
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Description (Optional)"
            value={task.description}
            onChangeText={text => handleTaskChange(index, 'description', text)}
            multiline
          />
        </View>
      ))}
      {tasks.length < 10 && (
        <TouchableOpacity style={styles.addButton} onPress={addTask}>
          <Text style={styles.addButtonText}>+ Add Another Task</Text>
        </TouchableOpacity>
      )}
      <View style={{ alignItems: 'flex-end' }}>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={nextStep}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Step 2: Review tasks
  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Step 2: Review Your Tasks</Text>
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Tips for Success:</Text>
        {TIPS.map((tip, i) => (
          <Text key={i} style={styles.tipItem}>• {tip}</Text>
        ))}
      </View>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Your 30-Day Tasks</Text>
        {tasks.map((task, index) => (
          <View key={index} style={styles.reviewTaskItem}>
            <Text style={styles.reviewTaskTitle}>{task.title}</Text>
            {task.description ? (
              <Text style={styles.reviewTaskDesc}>{task.description}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={prevStep}>
          <Text style={[styles.buttonText, styles.outlineButtonText]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={nextStep}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Step 3: Commit & pay
  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Step 3: Commit to Your 30-Day Journey</Text>
      <View style={styles.commitCard}>
        <Text style={styles.commitImportant}>Important:</Text>
        <Text style={styles.commitText}>
          Once created, your task list will be locked for 30 days. You won't be able to add, remove, or modify these tasks until the cycle ends.
        </Text>
        <Text style={styles.commitTextBold}>
          To start your 30-day challenge, a <Text style={{ color: colors.primary[600] }}>one-time payment of £2.99</Text> is required. This helps support the platform and unlocks your commitment.
        </Text>
      </View>
      <View style={styles.checkboxRow}>
        <CheckBox
          value={accepted}
          onValueChange={setAccepted}
        />
        <Text style={styles.checkboxLabel}>
          I understand that I am committing to these tasks for the next 30 days, and I cannot modify them during this period.
        </Text>
      </View>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={prevStep}>
          <Text style={[styles.buttonText, styles.outlineButtonText]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, (!accepted || loading) && styles.disabledButton]}
          onPress={handlePaymentAndCreate}
          disabled={!accepted || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Start My 30-Day Commitment (£2.99)</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Create Your 30-Day Commitment</Text>
      <Text style={styles.subtitle}>
        Set up the tasks you want to commit to for the next 30 days. Once created, these tasks cannot be changed until the cycle ends.
      </Text>
      {renderProgress()}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.card}>
        {activeStep === 1 && renderStep1()}
        {activeStep === 2 && renderStep2()}
        {activeStep === 3 && renderStep3()}
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
  title: {
    ...typography.h1,
    color: colors.secondary[900],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.secondary[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  progressBarContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: borderRadius.full,
  },
  progressActive: {
    backgroundColor: colors.primary[500],
  },
  progressInactive: {
    backgroundColor: colors.secondary[200],
  },
  card: {
    ...commonStyles.card,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error.text,
    backgroundColor: colors.error.light,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepTitle: {
    ...typography.h2,
    color: colors.secondary[900],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: colors.secondary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  taskLabel: {
    ...typography.body,
    fontWeight: 'bold',
    color: colors.secondary[800],
  },
  removeText: {
    color: colors.error.text,
    fontWeight: 'bold',
  },
  input: {
    ...commonStyles.input,
    marginBottom: spacing.sm,
  },
  addButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  addButtonText: {
    color: colors.primary[600],
    fontWeight: 'bold',
    fontSize: 16,
  },
  tipsCard: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tipsTitle: {
    ...typography.h3,
    color: colors.primary[700],
    marginBottom: spacing.sm,
  },
  tipItem: {
    ...typography.body,
    color: colors.secondary[700],
    marginBottom: 2,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.secondary[200],
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.secondary[50],
  },
  reviewTitle: {
    ...typography.h3,
    color: colors.secondary[900],
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary[200],
  },
  reviewTaskItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary[200],
  },
  reviewTaskTitle: {
    ...typography.body,
    color: colors.secondary[900],
    fontWeight: 'bold',
  },
  reviewTaskDesc: {
    ...typography.caption,
    color: colors.secondary[600],
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  button: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 120,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.primary[500],
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    color: colors.primary[500],
    fontWeight: 'bold',
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  commitCard: {
    backgroundColor: colors.error.light,
    borderColor: colors.error.dark,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  commitImportant: {
    ...typography.h3,
    color: colors.error.dark,
    marginBottom: spacing.sm,
  },
  commitText: {
    ...typography.body,
    color: colors.error.dark,
    marginBottom: spacing.sm,
  },
  commitTextBold: {
    ...typography.body,
    color: colors.error.dark,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.secondary[700],
    flex: 1,
    marginLeft: spacing.sm,
  },
});

export default CreateTasksScreen; 