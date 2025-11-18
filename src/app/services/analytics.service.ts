import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Analytics, logEvent, setUserId, setUserProperties } from '@angular/fire/analytics';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ConsentService } from './consent.service';
import { AnalyticsLoggerService } from './analytics-logger.service';
import { Cart, CartItem } from '../models/cart';
import { Product } from '../models/product';

interface PurchaseItemPayload {
  productId?: string;
  sku?: string;
  name: string;
  quantity: number;
  price?: number;
  category?: string;
  variant?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private consentService = inject(ConsentService);
  private analyticsLogger = inject(AnalyticsLoggerService);
  private analytics?: Analytics;
  private analyticsConsentGranted = false;
  private measurementId = environment.firebase?.measurementId;
  private gtagInitialized = false;
  private gtagLoadPromise: Promise<void> | null = null;
  private analyticsReady = false;
  private analyticsReadyPromise: Promise<boolean> | null = null;
  private pageTrackingInitialized = false;

  constructor() {
    if (!environment.production || !this.isBrowser) {
      return;
    }

    try {
      this.analytics = inject(Analytics);
    } catch (error) {
      console.warn('Analytics not available:', error);
    }

    this.consentService.consent$.subscribe(consent => {
      const previouslyGranted = this.analyticsConsentGranted;
      this.analyticsConsentGranted = consent.analytics;

      if (this.analyticsConsentGranted && !previouslyGranted) {
        void this.ensureAnalyticsReady();
      }
    });
  }

  initPageViewTracking(): void {
    if (!environment.production || !this.isBrowser || this.pageTrackingInitialized) {
      return;
    }

    this.pageTrackingInitialized = true;

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const path = event.urlAfterRedirects;
        this.trackPageView(path);
      });
  }

  trackPageView(path: string): void {
    if (!this.isBrowser) {
      return;
    }

    const pageLocation = window.location.href;
    const pageTitle = document.title;

    this.logEventSafely('page_view', {
      page_path: path,
      page_location: pageLocation,
      page_title: pageTitle
    });

    // Also log to Firestore with geographic data for analytics
    if (this.analyticsConsentGranted) {
      void this.analyticsLogger.logPageView(path);
    }
  }

  trackContactSubmit(method: 'form' | 'whatsapp' | 'email', additionalData?: Record<string, any>): void {
    this.logEventSafely('generate_lead', {
      method,
      page_location: this.isBrowser ? window.location.href : undefined,
      ...additionalData
    });

    // If it's a form submission with email and message, log as quote
    if (method === 'form' && additionalData?.['email'] && additionalData?.['message']) {
      void this.analyticsLogger.logQuoteRequest({
        email: additionalData['email'],
        message: additionalData['message'],
        productId: additionalData['productId'],
        productName: additionalData['productName']
      });
    }
  }

  trackProductClick(productName: string, category?: string): void {
    this.logEventSafely('select_content', {
      content_type: 'product',
      item_id: productName,
      item_category: category
    });
  }

  trackGalleryClick(projectName: string, category?: string): void {
    this.logEventSafely('select_content', {
      content_type: 'gallery',
      item_id: projectName,
      item_category: category
    });
  }

  trackCTAClick(ctaName: string, location?: string): void {
    this.logEventSafely('cta_click', {
      cta: ctaName,
      cta_location: location || (this.isBrowser ? window.location.pathname : undefined)
    });
  }

  trackOutboundLink(url: string, linkText?: string): void {
    this.logEventSafely('click', {
      link_url: url,
      link_text: linkText,
      outbound: true
    });
  }

  trackFileDownload(fileName: string, fileExtension?: string): void {
    const extension = fileExtension || fileName.split('.').pop();
    this.logEventSafely('file_download', {
      file_name: fileName,
      file_extension: extension,
      page_location: this.isBrowser ? window.location.href : undefined
    });
  }

  trackPageNotFound(path: string): void {
    this.logEventSafely('page_not_found', {
      page_path: path,
      page_location: this.isBrowser ? window.location.href : undefined
    });
  }

  trackSearch(searchTerm: string, resultCount?: number): void {
    this.logEventSafely('search', {
      search_term: searchTerm,
      result_count: resultCount
    });
  }

  trackFormStart(formId: string): void {
    this.logEventSafely('form_start', {
      form_id: formId,
      page_location: this.isBrowser ? window.location.href : undefined
    });
  }

  trackFormSubmit(formId: string, success: boolean = true): void {
    this.logEventSafely('form_submit', {
      form_id: formId,
      success,
      page_location: this.isBrowser ? window.location.href : undefined
    });
  }

  trackFormError(formId: string, errorField?: string): void {
    this.logEventSafely('form_error', {
      form_id: formId,
      field_name: errorField,
      page_location: this.isBrowser ? window.location.href : undefined
    });
  }

  trackAddToCart(product: Product, quantity: number = 1, currency?: string): void {
    const item = this.buildItemFromProduct(product, quantity);
    const value = (product.price || 0) * quantity;

    this.logEventSafely('add_to_cart', {
      currency: currency || 'USD',
      value,
      items: [item]
    });
  }

  trackBeginCheckout(cart: Cart): void {
    if (!cart || !cart.items?.length) {
      return;
    }

    const items = cart.items.map(item => this.buildItemFromCartItem(item));
    const value = cart.total ?? cart.subtotal ?? 0;

    this.logEventSafely('begin_checkout', {
      currency: cart.currency || 'USD',
      value,
      coupon: cart.promoCode || undefined,
      items
    });
  }

  trackAddPaymentInfo(cart: Cart, paymentType: string): void {
    if (!cart || !cart.items?.length) {
      return;
    }

    const items = cart.items.map(item => this.buildItemFromCartItem(item));
    const value = cart.total ?? cart.subtotal ?? 0;

    this.logEventSafely('add_payment_info', {
      currency: cart.currency || 'USD',
      value,
      payment_type: paymentType,
      items
    });
  }

  trackPurchase(params: {
    transactionId: string;
    currency: string;
    value: number;
    tax?: number;
    shipping?: number;
    discount?: number;
    items: PurchaseItemPayload[];
  }): void {
    if (!params.items?.length) {
      return;
    }

    const items = params.items.map(item => this.buildItem(item));

    this.logEventSafely('purchase', {
      transaction_id: params.transactionId,
      currency: params.currency || 'USD',
      value: params.value,
      tax: params.tax,
      shipping: params.shipping,
      discount: params.discount,
      items
    });
  }

  setUserProperty(properties: Record<string, any>): void {
    this.executeWhenReady(analytics => {
      setUserProperties(analytics, properties);
    });
  }

  setUserId(userId: string): void {
    this.executeWhenReady(analytics => {
      setUserId(analytics, userId);
    });
  }

  trackCustomEvent(eventName: string, params?: Record<string, any>): void {
    this.logEventSafely(eventName, params);
  }

  private logEventSafely(eventName: string, params?: Record<string, any>): void {
    this.executeWhenReady(analytics => {
      logEvent(analytics, eventName as any, params);
    });
  }

  private executeWhenReady(action: (analytics: Analytics) => void): void {
    if (!environment.production || !this.isBrowser) {
      return;
    }

    void this.ensureAnalyticsReady().then(ready => {
      if (!ready || !this.analytics) {
        return;
      }

      try {
        action(this.analytics);
      } catch (error) {
        console.error('Analytics action failed:', error);
      }
    });
  }

  private async ensureAnalyticsReady(): Promise<boolean> {
    if (this.analyticsReady) {
      return true;
    }

    if (!this.isBrowser || !environment.production) {
      return false;
    }

    if (!this.analytics || !this.analyticsConsentGranted) {
      return false;
    }

    if (!this.measurementId) {
      console.warn('GA4 measurement ID is not configured.');
      return false;
    }

    if (this.analyticsReadyPromise) {
      return this.analyticsReadyPromise;
    }

    this.analyticsReadyPromise = this.loadGtagScript()
      .then(() => {
        this.analyticsReady = this.gtagInitialized;
        return this.analyticsReady;
      })
      .catch(error => {
        console.error('Failed to initialize GA4:', error);
        return false;
      })
      .finally(() => {
        this.analyticsReadyPromise = null;
      });

    return this.analyticsReadyPromise;
  }

  private loadGtagScript(): Promise<void> {
    if (this.gtagInitialized) {
      return Promise.resolve();
    }

    if (this.gtagLoadPromise) {
      return this.gtagLoadPromise;
    }

    this.gtagLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-ga4-id="${this.measurementId}"]`);
      if (existing) {
        this.initializeGtag();
        resolve();
        return;
      }

      window.dataLayer = window.dataLayer || [];

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.dataset['ga4Id'] = this.measurementId!;
      script.onload = () => {
        this.initializeGtag();
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load GA4 script'));

      document.head.appendChild(script);
    }).finally(() => {
      this.gtagLoadPromise = null;
    });

    return this.gtagLoadPromise;
  }

  private initializeGtag(): void {
    if (this.gtagInitialized) {
      return;
    }

    window.dataLayer = window.dataLayer || [];

    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag(...args: any[]) {
        window.dataLayer.push(args);
      };
    }

    window.gtag('js', new Date());
    window.gtag('config', this.measurementId!, {
      send_page_view: false,
      anonymize_ip: true
    });

    this.gtagInitialized = true;
  }

  private buildItemFromProduct(product: Product, quantity: number): Record<string, any> {
    return this.buildItem({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity,
      price: product.price,
      category: product.modelId || product.categoryId || product.tags?.[0],
      variant: product.size
    });
  }

  private buildItemFromCartItem(item: CartItem): Record<string, any> {
    return this.buildItem({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.qty,
      price: item.unitPrice,
      category: item.grosor,
      variant: item.variantLabel
    });
  }

  private buildItem(payload: PurchaseItemPayload): Record<string, any> {
    const item: Record<string, any> = {
      item_id: payload.sku || payload.productId || payload.name,
      item_name: payload.name,
      quantity: payload.quantity
    };

    if (payload.price !== undefined) {
      item['price'] = Number(payload.price) || 0;
    }

    if (payload.category) {
      item['item_category'] = payload.category;
    }

    if (payload.variant) {
      item['item_variant'] = payload.variant;
    }

    if (payload.sku) {
      item['item_sku'] = payload.sku;
    }

    return item;
  }
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}
