import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  QueryConstraint,
  QuerySnapshot,
  collection,
  count,
  getAggregateFromServer,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  sum,
  where
} from '@angular/fire/firestore';
import { SettingsService } from './settings.service';

export type AdminActivityType = 'order' | 'product' | 'gallery' | 'user';
export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';
export type AnalyticsMetricKey =
  | 'totalOrders'
  | 'revenue'
  | 'averageOrderValue'
  | 'newCustomers'
  | 'productsUpdated'
  | 'galleryUploads';

export interface AdminActivityItem {
  id: string;
  type: AdminActivityType;
  description: string;
  timestamp: Date;
  icon: string;
  entityId?: string; // ID of the related entity (order ID, product ID, etc.)
}

export interface AdminDashboardSnapshot {
  totalProducts: number;
  totalOrders: number;
  totalGalleryImages: number;
  totalUsers: number;
  pendingOrders: number;
  pendingReviews: number;
  totalRevenue: number;
  currencyCode: string;
  recentActivity: AdminActivityItem[];
}

export interface AdminAnalyticsMetric {
  key: AnalyticsMetricKey;
  labelKey: string;
  format: 'number' | 'currency';
  currentValue: number;
  previousValue: number;
  changePercentage: number | null;
}

export interface AdminAnalyticsSnapshot {
  period: AnalyticsPeriod;
  currencyCode: string;
  metrics: AdminAnalyticsMetric[];
  recentActivity: AdminActivityItem[];
}

interface DateRange {
  start: Date;
  end: Date;
}

interface PeriodBounds {
  current: DateRange;
  previous: DateRange;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private firestore = inject(Firestore);
  private settingsService = inject(SettingsService);

  private cachedCurrencyCode: string | null = null;
  private currencyResolver: Promise<string> | null = null;
  private currencyFormatters = new Map<string, Intl.NumberFormat>();

  async getDashboardStats(): Promise<AdminDashboardSnapshot> {
    try {
      const currencyCode = await this.resolveCurrencyCode();

      const [
        totalProducts,
        ordersSummary,
        totalGalleryImages,
        totalUsers,
        pendingReviews,
        recentActivity
      ] = await Promise.all([
        this.getCollectionCount('products'),
        this.getOrdersSummary(currencyCode),
        this.getGalleryImagesCount(),
        this.getCollectionCount('users'),
        this.getPendingReviewsCount(),
        this.getRecentActivity(currencyCode, 8)
      ]);

      return {
        totalProducts,
        totalOrders: ordersSummary.total,
        totalGalleryImages,
        totalUsers,
        pendingOrders: ordersSummary.pending,
        pendingReviews,
        totalRevenue: ordersSummary.revenue,
        currencyCode,
        recentActivity
      };
    } catch (error) {
      console.error('[AdminDashboardService] Error in getDashboardStats:', error);
      return {
        totalProducts: 0,
        totalOrders: 0,
        totalGalleryImages: 0,
        totalUsers: 0,
        pendingOrders: 0,
        pendingReviews: 0,
        totalRevenue: 0,
        currencyCode: 'USD',
        recentActivity: []
      };
    }
  }

  async getAnalyticsSnapshot(period: AnalyticsPeriod): Promise<AdminAnalyticsSnapshot> {
    const currencyCode = await this.resolveCurrencyCode();
    const bounds = this.getPeriodBounds(period);

    try {
      const [
        currentOrders,
        previousOrders,
        currentUsers,
        previousUsers,
        currentProducts,
        previousProducts,
        currentGallery,
        previousGallery,
        recentActivity
      ] = await Promise.all([
        this.aggregateOrders(bounds.current),
        this.aggregateOrders(bounds.previous),
        this.countDocumentsInRange('users', 'createdAt', bounds.current),
        this.countDocumentsInRange('users', 'createdAt', bounds.previous),
        this.countDocumentsInRange('products', 'updatedAt', bounds.current, { fallbackField: 'createdAt' }),
        this.countDocumentsInRange('products', 'updatedAt', bounds.previous, { fallbackField: 'createdAt' }),
        this.countDocumentsInRange('media', 'uploadedAt', bounds.current, {
          additionalFilters: [where('relatedEntityType', '==', 'gallery')],
          filterPredicate: data => data['relatedEntityType'] === 'gallery'
        }),
        this.countDocumentsInRange('media', 'uploadedAt', bounds.previous, {
          additionalFilters: [where('relatedEntityType', '==', 'gallery')],
          filterPredicate: data => data['relatedEntityType'] === 'gallery'
        }),
        this.getRecentActivity(currencyCode, 10)
      ]);

      const metrics: AdminAnalyticsMetric[] = [
        {
          key: 'totalOrders',
          labelKey: 'admin.analytics.metrics.total_orders',
          format: 'number',
          currentValue: currentOrders.count,
          previousValue: previousOrders.count,
          changePercentage: this.calculateChange(currentOrders.count, previousOrders.count)
        },
        {
          key: 'revenue',
          labelKey: 'admin.analytics.metrics.revenue',
          format: 'currency',
          currentValue: currentOrders.revenue,
          previousValue: previousOrders.revenue,
          changePercentage: this.calculateChange(currentOrders.revenue, previousOrders.revenue)
        },
        {
          key: 'averageOrderValue',
          labelKey: 'admin.analytics.metrics.average_order_value',
          format: 'currency',
          currentValue: currentOrders.average,
          previousValue: previousOrders.average,
          changePercentage: this.calculateChange(currentOrders.average, previousOrders.average)
        },
        {
          key: 'newCustomers',
          labelKey: 'admin.analytics.metrics.new_customers',
          format: 'number',
          currentValue: currentUsers,
          previousValue: previousUsers,
          changePercentage: this.calculateChange(currentUsers, previousUsers)
        },
        {
          key: 'productsUpdated',
          labelKey: 'admin.analytics.metrics.products_updated',
          format: 'number',
          currentValue: currentProducts,
          previousValue: previousProducts,
          changePercentage: this.calculateChange(currentProducts, previousProducts)
        },
        {
          key: 'galleryUploads',
          labelKey: 'admin.analytics.metrics.gallery_uploads',
          format: 'number',
          currentValue: currentGallery,
          previousValue: previousGallery,
          changePercentage: this.calculateChange(currentGallery, previousGallery)
        }
      ];

      return {
        period,
        currencyCode,
        metrics,
        recentActivity
      };
    } catch (error) {
      console.error('[AdminDashboardService] Error building analytics snapshot:', error);
      return {
        period,
        currencyCode,
        metrics: [],
        recentActivity: []
      };
    }
  }

  async getRecentActivityFeed(maxItems = 6): Promise<AdminActivityItem[]> {
    const currencyCode = await this.resolveCurrencyCode();
    return this.getRecentActivity(currencyCode, maxItems);
  }

  private async resolveCurrencyCode(): Promise<string> {
    if (this.cachedCurrencyCode) {
      return this.cachedCurrencyCode;
    }

    if (!this.currencyResolver) {
      this.currencyResolver = this.settingsService
        .getSettings()
        .then(settings => (settings.stripeCurrency || 'USD').toUpperCase())
        .catch(() => 'USD')
        .finally(() => {
          this.currencyResolver = null;
        });
    }

    this.cachedCurrencyCode = await this.currencyResolver;
    return this.cachedCurrencyCode;
  }

  private getCurrencyFormatter(currencyCode: string): Intl.NumberFormat {
    if (!this.currencyFormatters.has(currencyCode)) {
      this.currencyFormatters.set(
        currencyCode,
        new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: currencyCode,
          maximumFractionDigits: 2
        })
      );
    }

    return this.currencyFormatters.get(currencyCode)!;
  }

  private async getCollectionCount(path: string): Promise<number> {
    const ref = collection(this.firestore, path);
    try {
      const snapshot = await getCountFromServer(ref);
      const data = snapshot.data();
      return this.normalizeNumber(data.count);
    } catch (error) {
      console.warn(`[AdminDashboardService] Falling back to manual count for ${path}:`, (error as Error).message);
      const snapshot = await getDocs(ref);
      return snapshot.size;
    }
  }

  private async getGalleryImagesCount(): Promise<number> {
    const mediaRef = collection(this.firestore, 'media');
    try {
      const snapshot = await getCountFromServer(
        query(mediaRef, where('relatedEntityType', '==', 'gallery'))
      );
      const data = snapshot.data();
      return this.normalizeNumber(data.count);
    } catch (error) {
      console.warn('[AdminDashboardService] Falling back to manual gallery count:', (error as Error).message);
      const snapshot = await getDocs(mediaRef);
      let count = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data?.['relatedEntityType'] === 'gallery') {
          count += 1;
        }
      });
      return count;
    }
  }

  private async getPendingReviewsCount(): Promise<number> {
    const reviewsRef = collection(this.firestore, 'productReviews');
    try {
      const snapshot = await getCountFromServer(
        query(reviewsRef, where('status', '==', 'pending'))
      );
      const data = snapshot.data();
      return this.normalizeNumber(data.count);
    } catch (error) {
      console.warn('[AdminDashboardService] Falling back to manual pending reviews count:', (error as Error).message);
      const snapshot = await getDocs(reviewsRef);
      let count = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data?.['status'] === 'pending') {
          count += 1;
        }
      });
      return count;
    }
  }

  private async getOrdersSummary(currencyCode: string): Promise<{
    total: number;
    pending: number;
    revenue: number;
  }> {
    const ordersRef = collection(this.firestore, 'orders');

    try {
      const [totalSnapshot, pendingSnapshot, revenueSnapshot] = await Promise.all([
        getCountFromServer(ordersRef),
        getCountFromServer(query(ordersRef, where('status', '==', 'pending'))),
        getAggregateFromServer(ordersRef, { totalRevenue: sum('total') })
      ]);

      const total = this.normalizeNumber(totalSnapshot.data().count);
      const pending = this.normalizeNumber(pendingSnapshot.data().count);
      const revenue = this.normalizeNumber(revenueSnapshot.data().totalRevenue);

      return { total, pending, revenue };
    } catch (error) {
      console.warn('[AdminDashboardService] Falling back to manual order summary:', (error as Error).message);
      const snapshot = await getDocs(ordersRef);
      let pending = 0;
      let revenue = 0;

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        const status = (data['status'] || 'pending').toString().toLowerCase();
        if (status === 'pending') {
          pending += 1;
        }

        const total = typeof data['total'] === 'number' ? data['total'] : Number(data['total'] ?? 0);
        if (!Number.isNaN(total)) {
          revenue += total;
        }
      });

      return {
        total: snapshot.size,
        pending,
        revenue
      };
    }
  }

  private async getRecentActivity(currencyCode: string, maxItems: number): Promise<AdminActivityItem[]> {
    const [
      orderEvents,
      productEvents,
      galleryEvents,
      userEvents
    ] = await Promise.all([
      this.getRecentOrdersActivity(10, currencyCode),
      this.getRecentProductsActivity(10),
      this.getRecentGalleryActivity(10),
      this.getRecentUsersActivity(10)
    ]);

    return [...orderEvents, ...productEvents, ...galleryEvents, ...userEvents]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
  }

  private async getRecentOrdersActivity(limitCount: number, currencyCode: string): Promise<AdminActivityItem[]> {
    const snapshot = await this.safeQuery(
      'orders',
      [orderBy('updatedAt', 'desc'), limit(limitCount)],
      'createdAt',
      limitCount
    );

    const formatter = this.getCurrencyFormatter(currencyCode);

    const entries = await Promise.all(
      snapshot.docs.map(async docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        const orderNumber = (data['orderNumber'] as string) || docSnap.id;
        const status = ((data['status'] as string) || 'pending').toString().toLowerCase();
        const total = typeof data['total'] === 'number' ? data['total'] : Number(data['total'] ?? 0);
        const timestamp = this.extractTimestamp(data['updatedAt'] ?? data['createdAt']);

        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const amountLabel = !Number.isNaN(total) ? ` · ${formatter.format(total)}` : '';

        return {
          id: docSnap.id,
          type: 'order' as AdminActivityType,
          description: `Order ${orderNumber} · ${statusLabel}${amountLabel}`,
          timestamp,
          icon: 'order',
          entityId: docSnap.id // Store order ID for navigation
        };
      })
    );

    return entries;
  }

  private async getRecentProductsActivity(limitCount: number): Promise<AdminActivityItem[]> {
    const snapshot = await this.safeQuery(
      'products',
      [orderBy('updatedAt', 'desc'), limit(limitCount)],
      'createdAt',
      limitCount
    );

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data() as Record<string, unknown>;
      const name = (data['name'] as string) || 'Product';
      const grosor =
        (data['specs'] as Record<string, unknown> | undefined)?.['grosor'] ||
        (data['grosor'] as string) ||
        '';
      const timestamp = this.extractTimestamp(data['updatedAt'] ?? data['createdAt']);

      return {
        id: docSnap.id,
        type: 'product' as AdminActivityType,
        description: grosor ? `${name} (${grosor}) updated` : `${name} updated`,
        timestamp,
        icon: 'product',
        entityId: docSnap.id // Store product ID for navigation
      };
    });
  }

  private async getRecentGalleryActivity(limitCount: number): Promise<AdminActivityItem[]> {
    const ref = collection(this.firestore, 'media');
    try {
      const snapshot = await getDocs(
        query(
          ref,
          where('relatedEntityType', '==', 'gallery'),
          orderBy('uploadedAt', 'desc'),
          limit(limitCount)
        )
      );

      return snapshot.docs.map(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        const altText = (data['altText'] as string) || '';
        const caption = (data['caption'] as string) || '';
        const description = altText || caption || 'Gallery media uploaded';
        const timestamp = this.extractTimestamp(data['uploadedAt']);

        return {
          id: docSnap.id,
          type: 'gallery' as AdminActivityType,
          description,
          timestamp,
          icon: 'gallery',
          entityId: docSnap.id // Store media ID for navigation
        };
      });
    } catch (error) {
      console.warn('[AdminDashboardService] Gallery query fell back to manual filtering:', (error as Error).message);
      const snapshot = await getDocs(query(ref, orderBy('uploadedAt', 'desc'), limit(limitCount * 2)));

      return snapshot.docs
        .map(docSnap => {
          const data = docSnap.data() as Record<string, unknown>;
          if (data['relatedEntityType'] !== 'gallery') {
            return null;
          }

          const altText = (data['altText'] as string) || '';
          const caption = (data['caption'] as string) || '';
          const description = altText || caption || 'Gallery media uploaded';
          const timestamp = this.extractTimestamp(data['uploadedAt']);

          return {
            id: docSnap.id,
            type: 'gallery' as AdminActivityType,
            description,
            timestamp,
            icon: 'gallery',
            entityId: docSnap.id // Store media ID for navigation
          } as AdminActivityItem;
        })
        .filter((item): item is AdminActivityItem => item !== null)
        .slice(0, limitCount);
    }
  }

  private async getRecentUsersActivity(limitCount: number): Promise<AdminActivityItem[]> {
    const snapshot = await this.safeQuery(
      'users',
      [orderBy('createdAt', 'desc'), limit(limitCount)],
      'createdAt',
      limitCount
    );

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data() as Record<string, unknown>;
      const displayName = (data['displayName'] as string) || '';
      const email = (data['email'] as string) || '';
      const description = displayName ? `New user: ${displayName}` : `New user registered: ${email}`;
      const timestamp = this.extractTimestamp(data['createdAt']);

      return {
        id: docSnap.id,
        type: 'user' as AdminActivityType,
        description,
        timestamp,
        icon: 'user',
        entityId: docSnap.id // Store user ID for navigation
      };
    });
  }

  private async safeQuery(
    collectionPath: string,
    constraints: QueryConstraint[],
    fallbackOrderField: string,
    limitCount: number
  ): Promise<QuerySnapshot<Record<string, unknown>>> {
    const ref = collection(this.firestore, collectionPath);
    try {
      return await getDocs(query(ref, ...constraints));
    } catch (error) {
      console.warn(
        `[AdminDashboardService] Falling back to ${fallbackOrderField} for ${collectionPath}:`,
        (error as Error).message
      );
      return getDocs(query(ref, orderBy(fallbackOrderField, 'desc'), limit(limitCount)));
    }
  }

  private extractTimestamp(value: unknown): Date {
    if (!value) {
      return new Date();
    }

    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }

    if (typeof value === 'number') {
      return new Date(value);
    }

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? new Date() : new Date(parsed);
    }

    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      return new Date((value as { seconds: number }).seconds * 1000);
    }

    return new Date();
  }

  private normalizeNumber(value: unknown): number {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  private calculateChange(current: number, previous: number): number | null {
    if (previous === 0) {
      if (current === 0) {
        return 0;
      }
      return null;
    }

    const change = ((current - previous) / previous) * 100;
    if (!Number.isFinite(change)) {
      return null;
    }

    return Math.round(change * 10) / 10;
  }

  private getPeriodBounds(period: AnalyticsPeriod): PeriodBounds {
    const now = new Date();
    const endCurrent = new Date(now);

    const startCurrent = new Date(now);
    startCurrent.setHours(0, 0, 0, 0);

    switch (period) {
      case 'today': {
        const previousStart = new Date(startCurrent);
        previousStart.setDate(previousStart.getDate() - 1);
        const previousEnd = new Date(startCurrent);

        return {
          current: { start: startCurrent, end: endCurrent },
          previous: { start: previousStart, end: previousEnd }
        };
      }
      case 'week': {
        startCurrent.setDate(startCurrent.getDate() - 6);
        const previousEnd = new Date(startCurrent);
        const previousStart = new Date(startCurrent);
        previousStart.setDate(previousStart.getDate() - 7);

        return {
          current: { start: startCurrent, end: endCurrent },
          previous: { start: previousStart, end: previousEnd }
        };
      }
      case 'month': {
        startCurrent.setDate(1);
        const previousEnd = new Date(startCurrent);
        const previousStart = new Date(startCurrent);
        previousStart.setMonth(previousStart.getMonth() - 1);

        return {
          current: { start: startCurrent, end: endCurrent },
          previous: { start: previousStart, end: previousEnd }
        };
      }
      case 'year': {
        startCurrent.setMonth(0, 1);
        const previousEnd = new Date(startCurrent);
        const previousStart = new Date(startCurrent);
        previousStart.setFullYear(previousStart.getFullYear() - 1);

        return {
          current: { start: startCurrent, end: endCurrent },
          previous: { start: previousStart, end: previousEnd }
        };
      }
      default:
        return {
          current: { start: startCurrent, end: endCurrent },
          previous: { start: startCurrent, end: startCurrent }
        };
    }
  }

  private async aggregateOrders(range: DateRange): Promise<{
    count: number;
    revenue: number;
    average: number;
  }> {
    const ordersRef = collection(this.firestore, 'orders');
    const constraints = this.buildRangeConstraints(range, 'createdAt');

    try {
      const aggregateSnapshot = await getAggregateFromServer(
        query(ordersRef, ...constraints),
        {
          orderCount: count(),
          totalRevenue: sum('total')
        }
      );

      const data = aggregateSnapshot.data();
      const countValue = this.normalizeNumber(data.orderCount);
      const revenueValue = this.normalizeNumber(data.totalRevenue);
      const averageValue = countValue > 0 ? revenueValue / countValue : 0;

      return {
        count: countValue,
        revenue: Math.round(revenueValue * 100) / 100,
        average: Math.round(averageValue * 100) / 100
      };
    } catch (error) {
      console.warn('[AdminDashboardService] Aggregate orders fallback:', (error as Error).message);
      const snapshot = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));

      let countValue = 0;
      let revenueValue = 0;

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        const timestamp = this.extractTimestamp(data['createdAt']);
        if (timestamp >= range.start && timestamp < range.end) {
          countValue += 1;
          const total = typeof data['total'] === 'number' ? data['total'] : Number(data['total'] ?? 0);
          if (!Number.isNaN(total)) {
            revenueValue += total;
          }
        }
      });

      const averageValue = countValue > 0 ? revenueValue / countValue : 0;
      return {
        count: countValue,
        revenue: Math.round(revenueValue * 100) / 100,
        average: Math.round(averageValue * 100) / 100
      };
    }
  }

  private async countDocumentsInRange(
    collectionPath: string,
    timestampField: string,
    range: DateRange,
    options?: {
      fallbackField?: string;
      additionalFilters?: QueryConstraint[];
      filterPredicate?: (data: Record<string, unknown>) => boolean;
    }
  ): Promise<number> {
    const ref = collection(this.firestore, collectionPath);
    const constraints = [
      ...this.buildRangeConstraints(range, timestampField),
      ...(options?.additionalFilters ?? [])
    ];

    try {
      const snapshot = await getCountFromServer(query(ref, ...constraints));
      return this.normalizeNumber(snapshot.data().count);
    } catch (error) {
      console.warn(
        `[AdminDashboardService] Count fallback for ${collectionPath}:`,
        (error as Error).message
      );
      const fallbackRef = await getDocs(
        query(ref, orderBy(options?.fallbackField ?? timestampField, 'desc'))
      );

      let countValue = 0;
      fallbackRef.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        if (options?.filterPredicate && !options.filterPredicate(data)) {
          return;
        }
        const timestamp = this.extractTimestamp(
          data[timestampField] ?? (options?.fallbackField ? data[options.fallbackField] : undefined)
        );
        if (timestamp >= range.start && timestamp < range.end) {
          countValue += 1;
        }
      });

      return countValue;
    }
  }

  private buildRangeConstraints(range: DateRange, field: string): QueryConstraint[] {
    const start = Timestamp.fromDate(range.start);
    const end = Timestamp.fromDate(range.end);
    return [where(field, '>=', start), where(field, '<', end)];
  }

  /**
   * Get revenue trend data for charts
   */
  async getRevenueTrend(period: AnalyticsPeriod): Promise<{ date: Date; revenue: number; orders: number; profit: number }[]> {
    try {
      const range = this.getPeriodBounds(period).current;
      const ordersRef = collection(this.firestore, 'orders');
      
      const q = query(
        ordersRef,
        where('status', '==', 'completed'),
        where('createdAt', '>=', Timestamp.fromDate(range.start)),
        where('createdAt', '<', Timestamp.fromDate(range.end)),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      
      // Group by day/week/month based on period
      const grouped = new Map<string, { revenue: number; orders: number; profit: number }>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data['createdAt']?.toDate();
        if (!date) return;

        const key = this.getDateKey(date, period);
        const current = grouped.get(key) || { revenue: 0, orders: 0, profit: 0 };
        const amount = data['totalAmount'] || 0;
        const cost = data['costPrice'] || (amount * 0.7); // Estimate 30% margin if no cost

        grouped.set(key, {
          revenue: current.revenue + amount,
          orders: current.orders + 1,
          profit: current.profit + (amount - cost)
        });
      });

      // Convert to array and sort
      return Array.from(grouped.entries())
        .map(([key, value]) => ({
          date: this.parseDateKey(key, period),
          ...value
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      console.error('[AdminDashboardService] Error getting revenue trend:', error);
      return [];
    }
  }

  /**
   * Get top performing products
   */
  async getTopProducts(period: AnalyticsPeriod, limit = 10): Promise<{ 
    productId: string; 
    productName: string; 
    revenue: number; 
    orders: number; 
    conversionRate: number;
    views: number;
  }[]> {
    try {
      const range = this.getPeriodBounds(period).current;
      const ordersRef = collection(this.firestore, 'orders');
      
      const q = query(
        ordersRef,
        where('status', '==', 'completed'),
        where('createdAt', '>=', Timestamp.fromDate(range.start)),
        where('createdAt', '<', Timestamp.fromDate(range.end))
      );

      const snapshot = await getDocs(q);
      
      // Aggregate by product
      const productStats = new Map<string, { 
        name: string; 
        revenue: number; 
        orders: number; 
        views: number;
      }>();

      snapshot.forEach(doc => {
        const data = doc.data();
        const items = data['items'] || [];
        
        items.forEach((item: any) => {
          const id = item.productId || '';
          const current = productStats.get(id) || { 
            name: item.productName || 'Unknown', 
            revenue: 0, 
            orders: 0,
            views: 0 
          };
          
          productStats.set(id, {
            ...current,
            revenue: current.revenue + (item.price * item.quantity),
            orders: current.orders + 1
          });
        });
      });

      // Convert to array and calculate conversion rate
      const results = Array.from(productStats.entries())
        .map(([productId, stats]) => ({
          productId,
          productName: stats.name,
          revenue: stats.revenue,
          orders: stats.orders,
          views: stats.views || stats.orders * 10, // Estimate 10% conversion if no views data
          conversionRate: stats.views > 0 ? (stats.orders / stats.views) * 100 : 10
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('[AdminDashboardService] Error getting top products:', error);
      return [];
    }
  }

  private getDateKey(date: Date, period: AnalyticsPeriod): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (period) {
      case 'today':
        return `${year}-${month}-${day} ${String(date.getHours()).padStart(2, '0')}:00`;
      case 'week':
      case 'month':
        return `${year}-${month}-${day}`;
      case 'year':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private parseDateKey(key: string, period: AnalyticsPeriod): Date {
    const parts = key.split(/[- :]/);
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    
    switch (period) {
      case 'today':
        const day = parseInt(parts[2]);
        const hour = parseInt(parts[3]);
        return new Date(year, month, day, hour);
      case 'week':
      case 'month':
        return new Date(year, month, parseInt(parts[2]));
      case 'year':
        return new Date(year, month, 1);
      default:
        return new Date(year, month, parseInt(parts[2] || '1'));
    }
  }

  /**
   * Get geographic breakdown of quotes and conversions
   */
  async getGeographicData(period: AnalyticsPeriod): Promise<Array<{
    country: string;
    countryCode: string;
    region: 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER';
    quotes: number;
    conversions: number;
    revenue: number;
  }>> {
    try {
      const range = this.getPeriodBounds(period).current;
      
      // Get all orders for this period
      const ordersRef = collection(this.firestore, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('createdAt', '>=', Timestamp.fromDate(range.start)),
        where('createdAt', '<', Timestamp.fromDate(range.end))
      );

      // Try to get quote requests (if collection exists)
      const quotesRef = collection(this.firestore, 'quotes');
      const quotesQuery = query(
        quotesRef,
        where('createdAt', '>=', Timestamp.fromDate(range.start)),
        where('createdAt', '<', Timestamp.fromDate(range.end))
      );

      const [ordersSnapshot, quotesSnapshot] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(quotesQuery).catch(() => ({ docs: [] as any[] })) // Gracefully handle if collection doesn't exist
      ]);

      // Aggregate by country
      const geoMap = new Map<string, {
        country: string;
        countryCode: string;
        region: 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER';
        quotes: number;
        conversions: number;
        revenue: number;
      }>();

      // Process quote requests from quotes collection
      quotesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const countryCode = this.extractCountryCode(data);
        if (!countryCode) return; // Skip if no country

        const country = this.getCountryName(countryCode);
        const region = this.getRegion(countryCode);

        if (!geoMap.has(countryCode)) {
          geoMap.set(countryCode, {
            country,
            countryCode,
            region,
            quotes: 0,
            conversions: 0,
            revenue: 0
          });
        }

        const current = geoMap.get(countryCode)!;
        current.quotes += 1;
      });

      // Process all orders
      ordersSnapshot.forEach(doc => {
        const data = doc.data();
        const countryCode = this.extractCountryCode(data);
        if (!countryCode) return; // Skip if no country

        const country = this.getCountryName(countryCode);
        const region = this.getRegion(countryCode);
        const status = (data['status'] || 'pending').toString().toLowerCase();

        if (!geoMap.has(countryCode)) {
          geoMap.set(countryCode, {
            country,
            countryCode,
            region,
            quotes: 0,
            conversions: 0,
            revenue: 0
          });
        }

        const current = geoMap.get(countryCode)!;
        
        // If we don't have separate quotes, count all orders as "interest"
        if (quotesSnapshot.docs.length === 0) {
          current.quotes += 1;
        }
        
        // Count completed/delivered/shipped as conversions
        if (status === 'completed' || status === 'delivered' || status === 'shipped') {
          current.conversions += 1;
          current.revenue += data['total'] || data['totalAmount'] || 0;
        }
      });

      return Array.from(geoMap.values())
        .filter(item => item.quotes > 0 || item.conversions > 0) // Show countries with any activity
        .sort((a, b) => b.quotes - a.quotes);
    } catch (error) {
      console.error('[AdminDashboardService] Error getting geographic data:', error);
      return [];
    }
  }

  /**
   * Extract country code from order/quote data
   */
  private extractCountryCode(data: any): string {
    // Try various fields where country might be stored
    let country = 
      data['countryCode'] ||
      data['country'] ||
      data['shippingAddress']?.countryCode ||
      data['shippingAddress']?.country ||
      data['billingAddress']?.countryCode ||
      data['billingAddress']?.country ||
      data['customerCountry'];

    // If we got a full country name, try to convert it to code
    if (country && country.length > 2) {
      country = this.convertCountryNameToCode(country);
    }

    // Default to empty if no country found - we'll filter these out
    return country ? String(country).toUpperCase() : '';
  }

  /**
   * Convert common country names to ISO codes
   */
  private convertCountryNameToCode(name: string): string {
    const nameToCode: Record<string, string> = {
      // Common name variations
      'United States': 'US',
      'United States of America': 'US',
      'USA': 'US',
      'United Kingdom': 'GB',
      'UK': 'GB',
      'Brazil': 'BR',
      'Brasil': 'BR',
      'Mexico': 'MX',
      'México': 'MX',
      'Germany': 'DE',
      'Deutschland': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'España': 'ES',
      'Italy': 'IT',
      'Italia': 'IT',
      'Canada': 'CA',
      'Canadá': 'CA',
      'Australia': 'AU',
      'Japan': 'JP',
      'China': 'CN',
      'India': 'IN',
      'Singapore': 'SG',
      'Netherlands': 'NL',
      'Argentina': 'AR',
      'Chile': 'CL',
      'Colombia': 'CO',
      'Peru': 'PE',
      'Perú': 'PE'
    };

    return nameToCode[name] || name;
  }

  /**
   * Get full country name from code
   */
  private getCountryName(code: string): string {
    const countryNames: Record<string, string> = {
      // LATAM
      'BR': 'Brazil',
      'MX': 'Mexico',
      'AR': 'Argentina',
      'CL': 'Chile',
      'CO': 'Colombia',
      'PE': 'Peru',
      'VE': 'Venezuela',
      'EC': 'Ecuador',
      
      // Europe
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'ES': 'Spain',
      'IT': 'Italy',
      'NL': 'Netherlands',
      'SE': 'Sweden',
      'NO': 'Norway',
      'PL': 'Poland',
      'CH': 'Switzerland',
      
      // APAC
      'CN': 'China',
      'JP': 'Japan',
      'KR': 'South Korea',
      'IN': 'India',
      'AU': 'Australia',
      'SG': 'Singapore',
      'TH': 'Thailand',
      'VN': 'Vietnam',
      'ID': 'Indonesia',
      'MY': 'Malaysia',
      'PH': 'Philippines',
      
      // North America
      'US': 'United States',
      'CA': 'Canada',
      
      // MENA
      'AE': 'UAE',
      'SA': 'Saudi Arabia',
      'IL': 'Israel',
      'TR': 'Turkey'
    };

    return countryNames[code] || code;
  }

  /**
   * Determine region from country code
   */
  private getRegion(code: string): 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER' {
    const latinAmerica = ['BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO'];
    const europe = ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'PL', 'CH', 'AT', 'BE', 'DK', 'FI', 'IE', 'PT'];
    const apac = ['CN', 'JP', 'KR', 'IN', 'AU', 'SG', 'TH', 'VN', 'ID', 'MY', 'PH', 'NZ', 'HK', 'TW'];
    const northAmerica = ['US', 'CA'];
    const mena = ['AE', 'SA', 'IL', 'TR', 'EG', 'QA', 'KW', 'OM', 'BH', 'JO', 'LB'];

    if (latinAmerica.includes(code)) return 'LATAM';
    if (europe.includes(code)) return 'EU';
    if (apac.includes(code)) return 'APAC';
    if (northAmerica.includes(code)) return 'NA';
    if (mena.includes(code)) return 'MENA';
    
    return 'OTHER';
  }
}

