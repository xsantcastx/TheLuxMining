import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';

export interface PageViewEvent {
  path: string;
  timestamp: any;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  userAgent?: string;
  referrer?: string;
  language?: string;
}

/**
 * Service to log page views and user interactions to Firestore
 * for geographic analytics and reporting
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsLoggerService {
  private firestore = inject(Firestore);
  private geoDataCache: { country?: string; countryCode?: string; region?: string } | null = null;
  private geoFetchAttempted = false;

  /**
   * Log a page view with geographic data
   */
  async logPageView(path: string): Promise<void> {
    try {
      // Get geo data from various sources
      const geoData = await this.getGeoData();

      const event: PageViewEvent = {
        path,
        timestamp: serverTimestamp(),
        ...geoData,
        userAgent: navigator.userAgent,
        referrer: document.referrer || undefined,
        language: navigator.language
      };

      const eventsRef = collection(this.firestore, 'pageViews');
      await addDoc(eventsRef, event);
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.debug('Failed to log page view:', error);
    }
  }

  /**
   * Log a quote/inquiry request with geographic data
   */
  async logQuoteRequest(data: {
    email: string;
    message: string;
    productId?: string;
    productName?: string;
  }): Promise<void> {
    try {
      const geoData = await this.getGeoData();

      const quote = {
        ...data,
        ...geoData,
        createdAt: serverTimestamp(),
        status: 'pending',
        source: 'website'
      };

      const quotesRef = collection(this.firestore, 'quotes');
      await addDoc(quotesRef, quote);
    } catch (error) {
      console.error('Failed to log quote request:', error);
      throw error; // Re-throw for form handling
    }
  }

  /**
   * Get geographic data from multiple sources
   */
  private async getGeoData(): Promise<{
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
  }> {
    // Return cached data if available
    if (this.geoDataCache) {
      return this.geoDataCache;
    }

    // Try to get from browser's geolocation (not very accurate for country)
    const browserGeo = await this.getGeoFromBrowser();
    
    // Try to get from IP lookup service
    const ipGeo = await this.getGeoFromIP();

    // Combine and cache
    this.geoDataCache = {
      ...browserGeo,
      ...ipGeo // IP geo takes precedence as it's more accurate for country
    };

    return this.geoDataCache;
  }

  /**
   * Get approximate location from browser (requires user permission)
   */
  private async getGeoFromBrowser(): Promise<{ city?: string }> {
    try {
      if (!navigator.geolocation) {
        return {};
      }

      // Don't actually request permission - too intrusive
      // Just return empty for now
      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Get country from IP address using free geolocation API
   */
  private async getGeoFromIP(): Promise<{
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
  }> {
    if (this.geoFetchAttempted) {
      return {};
    }

    this.geoFetchAttempted = true;

    try {
      // Use ipapi.co - free tier allows 1000 requests/day
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Geo lookup failed');
      }

      const data = await response.json();

      return {
        country: data.country_name,
        countryCode: data.country_code,
        region: data.region,
        city: data.city
      };
    } catch (error) {
      console.debug('IP geolocation lookup failed:', error);
      
      // Fallback: try to get from timezone
      return this.getGeoFromTimezone();
    }
  }

  /**
   * Fallback: rough country guess from timezone
   */
  private getGeoFromTimezone(): {
    country?: string;
    countryCode?: string;
  } {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Common timezone to country mapping
      const tzToCountry: Record<string, { country: string; code: string }> = {
        'America/New_York': { country: 'United States', code: 'US' },
        'America/Chicago': { country: 'United States', code: 'US' },
        'America/Denver': { country: 'United States', code: 'US' },
        'America/Los_Angeles': { country: 'United States', code: 'US' },
        'America/Mexico_City': { country: 'Mexico', code: 'MX' },
        'America/Sao_Paulo': { country: 'Brazil', code: 'BR' },
        'America/Buenos_Aires': { country: 'Argentina', code: 'AR' },
        'America/Santiago': { country: 'Chile', code: 'CL' },
        'America/Bogota': { country: 'Colombia', code: 'CO' },
        'Europe/London': { country: 'United Kingdom', code: 'GB' },
        'Europe/Paris': { country: 'France', code: 'FR' },
        'Europe/Berlin': { country: 'Germany', code: 'DE' },
        'Europe/Madrid': { country: 'Spain', code: 'ES' },
        'Europe/Rome': { country: 'Italy', code: 'IT' },
        'Europe/Amsterdam': { country: 'Netherlands', code: 'NL' },
        'Asia/Tokyo': { country: 'Japan', code: 'JP' },
        'Asia/Shanghai': { country: 'China', code: 'CN' },
        'Asia/Singapore': { country: 'Singapore', code: 'SG' },
        'Asia/Seoul': { country: 'South Korea', code: 'KR' },
        'Asia/Dubai': { country: 'UAE', code: 'AE' },
        'Australia/Sydney': { country: 'Australia', code: 'AU' }
      };

      const match = tzToCountry[timezone];
      if (match) {
        return {
          country: match.country,
          countryCode: match.code
        };
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Clear cached geo data (useful for testing)
   */
  clearGeoCache(): void {
    this.geoDataCache = null;
    this.geoFetchAttempted = false;
  }
}
