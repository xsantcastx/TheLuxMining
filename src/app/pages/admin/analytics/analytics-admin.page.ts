import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AdminSidebarComponent } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { LineChartComponent, ChartSeries } from '../../../shared/components/line-chart/line-chart.component';
import { GeoHeatmapComponent, GeoDataPoint } from '../../../shared/components/geo-heatmap/geo-heatmap.component';
import {
  AdminDashboardService,
  AdminActivityItem,
  AdminAnalyticsMetric,
  AnalyticsMetricKey,
  AnalyticsPeriod
} from '../../../services/admin-dashboard.service';
import { LoadingComponentBase } from '../../../core/classes/loading-component.base';

interface AnalyticsMetricCard {
  key: AnalyticsMetricKey;
  labelKey: string;
  formattedValue: string;
  changePercentage: number | null;
  iconPath: string;
  colorClass: string;
  format: 'number' | 'currency';
}

type InitiativeTone = 'discovery' | 'design' | 'development' | 'beta';

interface FutureInitiative {
  titleKey: string;
  descriptionKey: string;
  statusKey: string;
  tone: InitiativeTone;
}

@Component({
  selector: 'app-analytics-admin',
  standalone: true,
  imports: [CommonModule, TranslateModule, AdminSidebarComponent, LineChartComponent, GeoHeatmapComponent],
  templateUrl: './analytics-admin.page.html',
  styleUrls: ['./analytics-admin.page.scss']
})
export class AnalyticsAdminComponent extends LoadingComponentBase implements OnInit {
  private dashboardService = inject(AdminDashboardService);
  private numberFormatter = new Intl.NumberFormat();
  private currencyFormatterCache = new Map<string, Intl.NumberFormat>();
  
  metrics: AnalyticsMetricCard[] = [];
  selectedPeriod: AnalyticsPeriod = 'week';
  currencyCode = 'USD';
  recentActivity: AdminActivityItem[] = [];
  periodOptions: AnalyticsPeriod[] = ['today', 'week', 'month', 'year'];

  // Chart data
  revenueChartSeries: ChartSeries[] = [];
  topProducts: any[] = [];
  geoData: GeoDataPoint[] = [];
  showCharts = true; // Beta feature flag
  showGeoMap = true; // Design phase feature flag

  futureInitiatives: FutureInitiative[] = [
    {
      titleKey: 'admin.analytics.future_items.charts.title',
      descriptionKey: 'admin.analytics.future_items.charts.description',
      statusKey: 'admin.analytics.future_items.charts.status',
      tone: 'beta'
    },
    {
      titleKey: 'admin.analytics.future_items.top_products.title',
      descriptionKey: 'admin.analytics.future_items.top_products.description',
      statusKey: 'admin.analytics.future_items.top_products.status',
      tone: 'development'
    },
    {
      titleKey: 'admin.analytics.future_items.geo.title',
      descriptionKey: 'admin.analytics.future_items.geo.description',
      statusKey: 'admin.analytics.future_items.geo.status',
      tone: 'beta' // Changed from 'design' to 'beta' since now implemented
    },
    {
      titleKey: 'admin.analytics.future_items.funnels.title',
      descriptionKey: 'admin.analytics.future_items.funnels.description',
      statusKey: 'admin.analytics.future_items.funnels.status',
      tone: 'discovery'
    }
  ];

  async ngOnInit() {
    await this.loadAnalytics();
  }

  async loadAnalytics() {
    await this.withLoading(async () => {
      const snapshot = await this.dashboardService.getAnalyticsSnapshot(this.selectedPeriod);
      this.currencyCode = snapshot.currencyCode;

      this.metrics = snapshot.metrics.map(metric => this.mapMetricToCard(metric, snapshot.currencyCode));
      this.recentActivity = snapshot.recentActivity;

      // Load chart data if beta feature is enabled
      if (this.showCharts) {
        await this.loadChartData();
      }
    });
  }

  async loadChartData() {
    try {
      const [revenueTrend, topProducts, geoData] = await Promise.all([
        this.dashboardService.getRevenueTrend(this.selectedPeriod),
        this.dashboardService.getTopProducts(this.selectedPeriod, 10),
        this.showGeoMap ? this.dashboardService.getGeographicData(this.selectedPeriod) : Promise.resolve([])
      ]);

      // Prepare chart series
      this.revenueChartSeries = [
        {
          name: 'Revenue',
          data: revenueTrend.map(d => ({
            label: this.formatChartLabel(d.date),
            value: d.revenue,
            date: d.date
          })),
          color: '#F7931A' // bitcoin-orange
        },
        {
          name: 'Profit',
          data: revenueTrend.map(d => ({
            label: this.formatChartLabel(d.date),
            value: d.profit,
            date: d.date
          })),
          color: '#50C878' // green
        }
      ];

      this.topProducts = topProducts;
      this.geoData = geoData;
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  }

  private formatChartLabel(date: Date): string {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    
    switch (this.selectedPeriod) {
      case 'today':
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      case 'week':
      case 'month':
        return `${month} ${day}`;
      case 'year':
        return month;
      default:
        return `${month} ${day}`;
    }
  }

  async setPeriod(period: AnalyticsPeriod) {
    this.selectedPeriod = period;
    await this.loadAnalytics();
  }

  formatChange(change: number | null): string {
    if (change === null || Number.isNaN(change)) {
      return '—';
    }
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${change}%`;
  }

  getChangeClasses(change: number | null): string {
    if (change === null) {
      return 'text-bitcoin-gray';
    }
    if (change > 0) {
      return 'text-green-400';
    }
    if (change < 0) {
      return 'text-red-400';
    }
    return 'text-bitcoin-gray';
  }

  getStatusBadgeClasses(tone: InitiativeTone): string {
    const base = 'px-2 py-1 text-xs font-semibold rounded-full border';
    switch (tone) {
      case 'discovery':
        return `${base} bg-blue-500/10 border-blue-500/30 text-blue-300`;
      case 'design':
        return `${base} bg-purple-500/10 border-purple-500/30 text-purple-200`;
      case 'development':
        return `${base} bg-bitcoin-orange/10 border-bitcoin-orange/30 text-bitcoin-orange`;
      case 'beta':
        return `${base} bg-green-500/10 border-green-500/30 text-green-300`;
      default:
        return `${base} bg-white/10 border-white/20 text-white/70`;
    }
  }

  trackMetric(index: number, metric: AnalyticsMetricCard): string {
    return metric.key;
  }

  private mapMetricToCard(metric: AdminAnalyticsMetric, currencyCode: string): AnalyticsMetricCard {
    const display = this.getMetricDisplay(metric.key);
    return {
      key: metric.key,
      labelKey: metric.labelKey,
      formattedValue: this.formatMetricValue(metric.currentValue, metric.format, currencyCode),
      changePercentage: metric.changePercentage,
      iconPath: display.iconPath,
      colorClass: display.colorClass,
      format: metric.format
    };
  }

  private formatMetricValue(value: number, format: 'number' | 'currency', currencyCode: string): string {
    if (format === 'currency') {
      if (!this.currencyFormatterCache.has(currencyCode)) {
        this.currencyFormatterCache.set(
          currencyCode,
          new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 2
          })
        );
      }
      return this.currencyFormatterCache.get(currencyCode)!.format(value);
    }

    return this.numberFormatter.format(value);
  }

  private getMetricDisplay(key: AnalyticsMetricKey): { iconPath: string; colorClass: string } {
    const map: Record<AnalyticsMetricKey, { iconPath: string; colorClass: string }> = {
      totalOrders: {
        iconPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
        colorClass: 'bg-green-500/10 border-green-500/30 text-green-400'
      },
      revenue: {
        iconPath: 'M12 8c-1.657 0-3-.895-3-2s1.343-2 3-2 3 .895 3 2m-3 4c-1.657 0-3-.895-3-2s1.343-2 3-2 3 .895 3 2m-6 0v8c0 1.105 1.343 2 3 2s3-.895 3-2v-8m6 0c0 3.866-3.582 7-8 7s-8-3.134-8-7',
        colorClass: 'bg-bitcoin-gold/10 border-bitcoin-gold/30 text-bitcoin-gold'
      },
      averageOrderValue: {
        iconPath: 'M12 8c-2.21 0-4-1.343-4-3s1.79-3 4-3 4 1.343 4 3m-4 6c-2.21 0-4-1.343-4-3s1.79-3 4-3 4 1.343 4 3m-8 0v8c0 1.657 1.79 3 4 3s4-1.343 4-3v-8',
        colorClass: 'bg-bitcoin-orange/10 border-bitcoin-orange/30 text-bitcoin-orange'
      },
      newCustomers: {
        iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197',
        colorClass: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
      },
      productsUpdated: {
        iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
        colorClass: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
      },
      galleryUploads: {
        iconPath: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
        colorClass: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
      }
    };

    return map[key];
  }

  getActivityIcon(type: AdminActivityItem['type']): string {
    const icons: Record<AdminActivityItem['type'], string> = {
      order: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      product: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      gallery: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    };
    return icons[type];
  }

  getActivityColor(type: AdminActivityItem['type']): string {
    const colors: Record<AdminActivityItem['type'], string> = {
      order: 'bg-bitcoin-orange/20 text-bitcoin-orange border border-bitcoin-orange/30',
      product: 'bg-bitcoin-gold/20 text-bitcoin-gold border border-bitcoin-gold/30',
      gallery: 'bg-luxury-gold/20 text-luxury-gold border border-luxury-gold/30',
      user: 'bg-bitcoin-orange/20 text-bitcoin-orange border border-bitcoin-orange/30'
    };
    return colors[type];
  }

  getRegionStats(region: string): { quotes: number; conversions: number; rate: number } | null {
    const regionData = this.geoData.filter(d => d.region === region);
    if (regionData.length === 0) return null;

    const quotes = regionData.reduce((sum, d) => sum + d.quotes, 0);
    const conversions = regionData.reduce((sum, d) => sum + d.conversions, 0);
    const rate = quotes > 0 ? (conversions / quotes) * 100 : 0;

    return { quotes, conversions, rate };
  }
}
