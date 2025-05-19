import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PomodoroTimer = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(25 * 60); // Default 25 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [selectedSeconds, setSelectedSeconds] = useState(0);
  const [restTime, setRestTime] = useState(5); // Default 5 minutes rest
  const [isRestMode, setIsRestMode] = useState(false);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(4);
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  // Generate options for minutes and seconds
  const minuteOptions = Array.from({ length: 61 }, (_, i) => i);
  const secondOptions = Array.from({ length: 60 }, (_, i) => i);
  const roundOptions = Array.from({ length: 10 }, (_, i) => i + 1); // 1-10 rounds

  // Calculate progress percentage for the circle
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  useEffect(() => {
    let interval;
    if (isRunning && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Play notification sound when timer ends
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
      audio.play();
      
      if (!isRestMode) {
        // Focus time ended, switch to rest
        setIsRestMode(true);
        setTimeLeft(restTime * 60);
        setTotalTime(restTime * 60);
      } else {
        // Rest time ended, check if we should continue to next round
        if (currentRound < totalRounds) {
          setIsRestMode(false);
          setTimeLeft(selectedMinutes * 60 + selectedSeconds);
          setTotalTime(selectedMinutes * 60 + selectedSeconds);
          setCurrentRound(prev => prev + 1);
        } else {
          // All rounds completed
          setIsSessionComplete(true);
          setIsRunning(false);
          setIsRestMode(false);
          setCurrentRound(1);
          setTimeLeft(selectedMinutes * 60 + selectedSeconds);
          setTotalTime(selectedMinutes * 60 + selectedSeconds);
        }
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, timeLeft, isRestMode, restTime, selectedMinutes, selectedSeconds, currentRound, totalRounds]);

  // Update time when settings change
  useEffect(() => {
    if (!isRunning && !isPaused) {
      setTimeLeft(selectedMinutes * 60 + selectedSeconds);
      setTotalTime(selectedMinutes * 60 + selectedSeconds);
    }
  }, [selectedMinutes, selectedSeconds]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!isRunning) {
      setTimeLeft(selectedMinutes * 60 + selectedSeconds);
      setTotalTime(selectedMinutes * 60 + selectedSeconds);
      setIsSessionComplete(false);
    }
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsRestMode(false);
    setIsSessionComplete(false);
    setCurrentRound(1);
    setTimeLeft(selectedMinutes * 60 + selectedSeconds);
    setTotalTime(selectedMinutes * 60 + selectedSeconds);
  };

  const handleCancel = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsRestMode(false);
    setIsSessionComplete(false);
    setCurrentRound(1);
    setTimeLeft(selectedMinutes * 60 + selectedSeconds);
    setTotalTime(selectedMinutes * 60 + selectedSeconds);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-primary-50 dark:bg-secondary-900 transition-colors duration-200">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Pomodoro Timer</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mt-2">
          Customize your focus sessions with a personalized timer
        </p>
      </div>

      {/* Timer Display with Circle Progress */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-8 mb-8 text-center transition-colors duration-200">
        <div className="relative w-64 h-64 mx-auto mb-8">
          {/* Circle Progress */}
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-secondary-200 dark:text-secondary-700"
            />
            {/* Progress Circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 120}`}
              strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
              className={`transition-all duration-1000 ease-linear ${
                isRestMode 
                  ? 'text-green-500 dark:text-green-400' 
                  : 'text-primary-600 dark:text-primary-400'
              }`}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Timer Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl font-bold text-primary-600 dark:text-primary-400 font-mono">
              {formatTime(timeLeft)}
            </div>
            <div className="text-sm text-secondary-600 dark:text-secondary-400 mt-2">
              {isRestMode ? 'Rest Time' : 'Focus Time'}
            </div>
            <div className="text-sm text-secondary-500 dark:text-secondary-500 mt-1">
              Round {currentRound} of {totalRounds}
            </div>
          </div>
        </div>

        {/* Session Complete Message */}
        {isSessionComplete && (
          <div className="mb-8 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <p className="text-green-700 dark:text-green-400 font-medium">
              🎉 Session Complete! Great job!
            </p>
          </div>
        )}

        {/* Timer Controls */}
        <div className="flex justify-center space-x-4 mb-8">
          {!isRunning && !isPaused && (
            <button
              onClick={handleStart}
              className="btn btn-primary px-8 py-3 hover:scale-105 transition-transform duration-200"
            >
              Start
            </button>
          )}
          {isRunning && !isPaused && (
            <button
              onClick={handlePause}
              className="btn btn-secondary px-8 py-3 hover:scale-105 transition-transform duration-200"
            >
              Pause
            </button>
          )}
          {isPaused && (
            <button
              onClick={handleResume}
              className="btn btn-primary px-8 py-3 hover:scale-105 transition-transform duration-200"
            >
              Resume
            </button>
          )}
          {(isRunning || isPaused) && (
            <button
              onClick={handleCancel}
              className="btn btn-outline px-8 py-3 hover:scale-105 transition-transform duration-200"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Timer Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Focus Minutes
            </label>
            <select
              value={selectedMinutes}
              onChange={(e) => setSelectedMinutes(Number(e.target.value))}
              disabled={isRunning || isPaused}
              className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
            >
              {minuteOptions.map((min) => (
                <option key={min} value={min}>
                  {min}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Focus Seconds
            </label>
            <select
              value={selectedSeconds}
              onChange={(e) => setSelectedSeconds(Number(e.target.value))}
              disabled={isRunning || isPaused}
              className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
            >
              {secondOptions.map((sec) => (
                <option key={sec} value={sec}>
                  {sec.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Rest Minutes
            </label>
            <select
              value={restTime}
              onChange={(e) => setRestTime(Number(e.target.value))}
              disabled={isRunning || isPaused}
              className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
            >
              {minuteOptions.slice(1, 31).map((min) => (
                <option key={min} value={min}>
                  {min}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
              Number of Rounds
            </label>
            <select
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
              disabled={isRunning || isPaused}
              className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-secondary-700 dark:text-white"
            >
              {roundOptions.map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-card p-6 transition-colors duration-200">
        <h3 className="text-lg font-semibold mb-4 text-secondary-900 dark:text-white">Pomodoro Tips</h3>
        <ul className="space-y-2 text-secondary-600 dark:text-secondary-300">
          <li>• Take a {restTime}-minute break after each session</li>
          <li>• Complete {totalRounds} rounds of focus and rest</li>
          <li>• Use this time for focused, distraction-free work</li>
          <li>• Stay hydrated and stretch during breaks</li>
        </ul>
      </div>
    </div>
  );
};

export default PomodoroTimer; 