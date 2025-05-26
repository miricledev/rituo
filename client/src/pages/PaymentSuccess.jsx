import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useTask } from '../contexts/TaskContext';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const { createTasks } = useTask();
  const hasCreatedTasks = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const paymentIntentId = searchParams.get('payment_intent');
    if (paymentIntentId && !hasCreatedTasks.current) {
      axios.post('payments/verify-payment', { paymentIntentId })
        .then(async response => {
          if (!isMounted) return;
          if (response.data.success) {
            const pendingTasksRaw = localStorage.getItem('pendingTasks');
            localStorage.removeItem('pendingTasks'); // Remove immediately
            if (pendingTasksRaw && !hasCreatedTasks.current) {
              const pendingTasks = JSON.parse(pendingTasksRaw);
              if (pendingTasks.length > 0) {
                await createTasks(pendingTasks);
                hasCreatedTasks.current = true;
              }
            }
            setStatus('success');
            setTimeout(() => {
              if (isMounted) {
                window.location.replace('/dashboard');
              }
            }, 2000);
          } else {
            setStatus('failed');
          }
        })
        .catch(() => {
          if (isMounted) setStatus('failed');
        });
    } else if (!paymentIntentId) {
      setStatus('failed');
    }
    return () => { isMounted = false; };
  }, [searchParams, navigate, createTasks]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
      <div className="max-w-md w-full mx-auto p-6 bg-white dark:bg-secondary-800 rounded-lg shadow-xl">
        {status === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <h2 className="mt-4 text-xl font-semibold text-secondary-900 dark:text-white">
              Verifying Payment...
            </h2>
            <p className="mt-2 text-secondary-600 dark:text-secondary-300">
              Please wait while we confirm your payment.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-secondary-900 dark:text-white">
              Payment Successful!
            </h2>
            <p className="mt-2 text-secondary-600 dark:text-secondary-300">
              Your 30-day challenge has been activated.
            </p>
            <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
              You can now access your dashboard.
            </p>
            <button
              className="mt-4 btn btn-primary"
              onClick={() => window.location.replace('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-secondary-900 dark:text-white">
              Payment Failed
            </h2>
            <p className="mt-2 text-secondary-600 dark:text-secondary-300">
              There was an issue processing your payment.
            </p>
            <button
              onClick={() => navigate('/tasks/new')}
              className="mt-4 btn btn-primary"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess; 