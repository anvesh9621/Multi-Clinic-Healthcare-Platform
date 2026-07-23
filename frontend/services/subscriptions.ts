import api from './api';

export const subscriptionService = {
  /** Get the current subscription for the logged-in clinic admin */
  getCurrent: () => api.get('/subscriptions/status/'),

  /**
   * Create a Razorpay subscription and return:
   *   { razorpay_key, subscription_id }
   * The caller opens the Razorpay SDK with these values.
   */
  createSubscription: (plan: 'professional' | 'enterprise') =>
    api.post('/subscriptions/create/', { plan }),

  /**
   * Verify the Razorpay payment after the user completes checkout.
   * Payload: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
   */
  verifySubscription: (payload: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => api.post('/subscriptions/verify/', payload),

  /** Cancel the active subscription */
  cancel: () => api.post('/subscriptions/cancel/'),
};
