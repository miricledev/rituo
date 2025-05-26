import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import axios from 'axios';

// Load Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit called');
    if (!stripe || !elements) {
      console.log('Stripe or elements not ready');
      return;
    }
    setProcessing(true);
    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });
      console.log('stripe.confirmPayment finished', submitError);
      if (submitError) {
        setError(submitError.message);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">
          Start Your 30-Day Challenge
        </h2>
        <p className="text-secondary-600 dark:text-secondary-300">
          Pay £2.99 to begin your journey
        </p>
      </div>

      <PaymentElement className="mb-6" />

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="btn btn-primary"
        >
          {processing ? 'Processing...' : 'Pay £2.99'}
        </button>
      </div>
    </form>
  );
};

const PaymentModal = ({ isOpen, onClose, onSuccess }) => {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Create PaymentIntent as soon as the modal opens
      axios.post('payments/create-payment-intent', {})
        .then((response) => {
          setClientSecret(response.data.clientSecret);
        })
        .catch((error) => {
          console.error('Error creating payment intent:', error);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#0ea5e9',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#ef4444',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '4px',
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {clientSecret ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance,
            }}
          >
            <PaymentForm onSuccess={onSuccess} onCancel={onClose} />
          </Elements>
        ) : (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-4 text-secondary-600 dark:text-secondary-300">
              Loading payment form...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal; 