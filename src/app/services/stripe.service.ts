import { Injectable, inject } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripeCardElement, PaymentIntent } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';
import { Observable, from, BehaviorSubject } from 'rxjs';

/**
 * Service for Stripe payment processing
 * Handles card tokenization, payment confirmation, and 3D Secure authentication
 */
@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private stripePromise: Promise<Stripe | null>;
  private stripe$ = new BehaviorSubject<Stripe | null>(null);
  
  constructor() {
    // Load Stripe.js asynchronously
    this.stripePromise = loadStripe(environment.stripe.publishableKey);
    this.initializeStripe();
  }

  /**
   * Initialize Stripe instance
   */
  private async initializeStripe() {
    try {
      const stripe = await this.stripePromise;
      this.stripe$.next(stripe);
    } catch (error) {
      console.error('Failed to load Stripe:', error);
    }
  }

  /**
   * Get Stripe instance
   */
  async getStripe(): Promise<Stripe | null> {
    return this.stripePromise;
  }

  /**
   * Create card Elements for payment form
   * @param elementId - HTML element ID to mount the card element
   */
  async createCardElement(elementId: string): Promise<{
    elements: StripeElements;
    cardElement: StripeCardElement;
  } | null> {
    const stripe = await this.getStripe();
    if (!stripe) {
      console.error('Stripe not loaded');
      throw new Error('Stripe failed to load');
    }

    console.log('Creating Stripe Elements with dark theme...');

    // Create Elements instance
    const elements = stripe.elements({
      appearance: {
        theme: 'night', // Dark theme to match Bitcoin aesthetic
        variables: {
          colorPrimary: '#f7931a', // Bitcoin orange
          colorBackground: '#0a0b0d',
          colorText: '#ffffff',
          colorDanger: '#ef4444',
          fontFamily: 'system-ui, sans-serif',
          spacingUnit: '4px',
          borderRadius: '12px',
        },
        rules: {
          '.Input': {
            backgroundColor: '#13151a',
            border: '1px solid rgba(247, 147, 26, 0.2)',
            padding: '12px',
          },
          '.Input:focus': {
            border: '2px solid rgba(247, 147, 26, 0.5)',
            boxShadow: '0 0 0 3px rgba(247, 147, 26, 0.1)',
          },
          '.Label': {
            color: '#9ca3af',
            fontSize: '14px',
            fontWeight: '600',
          },
        },
      },
    });

    console.log('Creating card element...');

    // Create card element
    const cardElement = elements.create('card', {
      style: {
        base: {
          iconColor: '#f7931a',
          color: '#fff',
          fontWeight: '500',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          fontSmoothing: 'antialiased',
          '::placeholder': {
            color: '#6b7280',
          },
        },
        invalid: {
          iconColor: '#ef4444',
          color: '#ef4444',
        },
      },
      hidePostalCode: true, // We collect this separately
    });

    console.log('Mounting card element to #' + elementId);

    // Mount to DOM
    const element = document.getElementById(elementId);
    if (element) {
      try {
        cardElement.mount(`#${elementId}`);
        console.log('Card element mounted successfully');
      } catch (mountError) {
        console.error('Error mounting card element:', mountError);
        throw mountError;
      }
    } else {
      console.error('Element with id "' + elementId + '" not found in DOM');
      throw new Error(`Element #${elementId} not found`);
    }

    return { elements, cardElement };
  }

  /**
   * Confirm a payment with client secret
   * @param clientSecret - PaymentIntent client secret from backend
   * @param cardElement - Stripe card element
   * @param billingDetails - Billing address information
   */
  async confirmCardPayment(
    clientSecret: string,
    cardElement: StripeCardElement,
    billingDetails: {
      name: string;
      email: string;
      phone?: string;
      address?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
    }
  ): Promise<{ paymentIntent?: PaymentIntent; error?: any }> {
    const stripe = await this.getStripe();
    if (!stripe) {
      return { error: { message: 'Stripe not loaded' } };
    }

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: billingDetails,
        },
      });

      if (result.error) {
        // Payment failed
        console.error('Payment confirmation error:', result.error);
        return { error: result.error };
      }

      // Payment succeeded
      return { paymentIntent: result.paymentIntent };
    } catch (error) {
      console.error('Payment error:', error);
      return { error };
    }
  }

  /**
   * Handle card action (e.g., 3D Secure authentication)
   * This is called when payment requires additional authentication
   */
  async handleCardAction(clientSecret: string): Promise<{ paymentIntent?: PaymentIntent; error?: any }> {
    const stripe = await this.getStripe();
    if (!stripe) {
      return { error: { message: 'Stripe not loaded' } };
    }

    try {
      const result = await stripe.handleCardAction(clientSecret);

      if (result.error) {
        return { error: result.error };
      }

      return { paymentIntent: result.paymentIntent };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Retrieve a PaymentIntent by client secret
   */
  async retrievePaymentIntent(clientSecret: string): Promise<PaymentIntent | null> {
    const stripe = await this.getStripe();
    if (!stripe) {
      return null;
    }

    try {
      const result = await stripe.retrievePaymentIntent(clientSecret);
      if (result.error) {
        console.error('Error retrieving payment intent:', result.error);
        return null;
      }
      return result.paymentIntent;
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      return null;
    }
  }

  /**
   * Get user-friendly error message from Stripe error
   */
  getErrorMessage(error: any): string {
    if (!error) return 'An unknown error occurred';

    switch (error.code) {
      case 'card_declined':
        return 'Your card was declined. Please try a different payment method.';
      case 'expired_card':
        return 'Your card has expired. Please use a different card.';
      case 'incorrect_cvc':
        return 'The security code is incorrect. Please check and try again.';
      case 'processing_error':
        return 'An error occurred processing your card. Please try again.';
      case 'incorrect_number':
        return 'The card number is incorrect. Please check and try again.';
      case 'invalid_expiry_month':
      case 'invalid_expiry_year':
        return 'The expiration date is invalid. Please check and try again.';
      case 'insufficient_funds':
        return 'Your card has insufficient funds. Please use a different payment method.';
      default:
        return error.message || 'Payment failed. Please try again.';
    }
  }

  /**
   * Format amount for display (cents to dollars)
   */
  formatAmount(amountInCents: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amountInCents / 100);
  }

  /**
   * Convert dollars to cents for Stripe
   */
  toCents(amount: number): number {
    return Math.round(amount * 100);
  }
}
