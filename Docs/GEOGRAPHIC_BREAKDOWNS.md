# Geographic Breakdowns Feature - Implementation Guide

## Overview

The **Geographic Breakdowns** feature provides visual heatmaps and analytics to track quote requests and conversions across different regions (LATAM, EU, APAC, NA, MENA). This helps identify expansion opportunities and regional performance trends.

**Status:** Internal Beta  
**Location:** `/admin/analytics`  
**Feature Flag:** `showGeoMap = true`

---

## Components

### 1. GeoHeatmapComponent
**Location:** `src/app/shared/components/geo-heatmap/geo-heatmap.component.ts`

A standalone Angular component that renders an interactive SVG world map with data points.

**Features:**
- SVG-based world map with simplified continent outlines
- Interactive data points sized by quote volume
- Hover tooltips showing:
  - Country name and region
  - Quote requests count
  - Conversions count
  - Conversion rate (color-coded)
  - Revenue total
- Pulse animations for high-activity countries (>50 quotes)
- Region-based color coding:
  - LATAM: `#F7931A` (bitcoin-orange)
  - EU: `#4A90E2` (blue)
  - APAC: `#50C878` (green)
  - NA: `#9B59B6` (purple)
  - MENA: `#E74C3C` (red)
- Built-in legend and country coordinate mapping

**Input:**
```typescript
@Input() geoData: GeoDataPoint[] = [];

interface GeoDataPoint {
  country: string;
  countryCode: string;
  region: 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER';
  quotes: number;
  conversions: number;
  revenue: number;
  lat?: number;
  lng?: number;
}
```

**Country Coordinates:**
Pre-configured for 30+ countries including:
- **LATAM:** BR, MX, AR, CL, CO, PE
- **Europe:** GB, DE, FR, ES, IT, NL, SE, NO, PL
- **APAC:** CN, JP, KR, IN, AU, SG, TH, VN, ID, MY, PH
- **North America:** US, CA
- **MENA:** AE, SA, IL, TR

---

### 2. AdminDashboardService - Geographic Methods
**Location:** `src/app/services/admin-dashboard.service.ts`

New methods added to support geographic analytics:

#### `getGeographicData(period: AnalyticsPeriod)`
Aggregates quotes and orders by country for the selected time period.

**Data Sources:**
- `quotes` collection - for quote requests
- `orders` collection - for conversions

**Returns:**
```typescript
Array<{
  country: string;
  countryCode: string;
  region: 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER';
  quotes: number;
  conversions: number;
  revenue: number;
}>
```

**Country Detection:**
Checks multiple fields in order of priority:
1. `countryCode`
2. `country`
3. `shippingAddress.countryCode`
4. `shippingAddress.country`
5. `billingAddress.countryCode`
6. `billingAddress.country`
7. `customerCountry`
8. Defaults to `'US'`

#### Supporting Methods

**`extractCountryCode(data: any): string`**
- Safely extracts country code from various data structures
- Normalizes to uppercase 2-letter codes

**`getCountryName(code: string): string`**
- Maps country codes to full names
- Covers 30+ countries

**`getRegion(code: string): 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER'`**
- Categorizes countries into regions for aggregation

---

### 3. Analytics Page Integration
**Location:** `src/app/pages/admin/analytics/analytics-admin.page.ts`

**New Properties:**
```typescript
geoData: GeoDataPoint[] = [];
showGeoMap = true; // Feature flag
```

**Updated `loadChartData()` Method:**
```typescript
async loadChartData() {
  const [revenueTrend, topProducts, geoData] = await Promise.all([
    this.dashboardService.getRevenueTrend(this.selectedPeriod),
    this.dashboardService.getTopProducts(this.selectedPeriod, 10),
    this.showGeoMap 
      ? this.dashboardService.getGeographicData(this.selectedPeriod) 
      : Promise.resolve([])
  ]);
  
  this.geoData = geoData;
}
```

**New Method:**
```typescript
getRegionStats(region: string): { 
  quotes: number; 
  conversions: number; 
  rate: number 
} | null {
  const regionData = this.geoData.filter(d => d.region === region);
  if (regionData.length === 0) return null;

  const quotes = regionData.reduce((sum, d) => sum + d.quotes, 0);
  const conversions = regionData.reduce((sum, d) => sum + d.conversions, 0);
  const rate = quotes > 0 ? (conversions / quotes) * 100 : 0;

  return { quotes, conversions, rate };
}
```

---

## Template Structure

**Location:** `src/app/pages/admin/analytics/analytics-admin.page.html`

```html
<!-- Geographic Breakdowns (Internal Beta) -->
@if (showGeoMap && geoData.length > 0) {
  <div class="bg-bitcoin-dark/40 ...">
    <!-- Header with Export Button -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3>Geographic Breakdowns</h3>
        <span class="badge">Internal Beta</span>
      </div>
      <button>Export Report</button>
    </div>

    <!-- Heatmap (500px height) -->
    <div class="h-[500px] ...">
      <app-geo-heatmap [geoData]="geoData"></app-geo-heatmap>
    </div>

    <!-- Regional Summary Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
      @for (region of ['LATAM', 'EU', 'APAC', 'NA']; track region) {
        @if (getRegionStats(region); as stats) {
          <div class="stat-card">
            <div>{{ region }}</div>
            <div>Quotes: {{ stats.quotes }}</div>
            <div>Conversions: {{ stats.conversions }}</div>
            <div>Rate: {{ stats.rate }}%</div>
          </div>
        }
      }
    </div>
  </div>
}
```

---

## Firestore Data Structure

### Quotes Collection
```typescript
{
  country: string;           // "Brazil"
  countryCode: string;        // "BR"
  email: string;
  message: string;
  createdAt: Timestamp;
  status: string;
}
```

### Orders Collection
```typescript
{
  orderNumber: string;
  countryCode: string;        // "BR"
  country: string;            // "Brazil"
  shippingAddress: {
    country: string;
    countryCode: string;
    city: string;
    postalCode: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  totalAmount: number;
  status: string;             // "completed" for conversions
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Seeding Test Data

Run the geographic data seeder to populate test data:

```bash
npx ts-node scripts/seed-geo-data.ts
```

**What it creates:**
- 100 quote requests across 17 countries
- 15 completed orders (~15% conversion rate)
- Realistic distribution weighted by region importance
- Date spread across last 30 days

**Distribution:**
- LATAM: 60% of quotes (Brazil, Mexico, Argentina, Chile, Colombia)
- Europe: 42% (UK, Germany, France, Netherlands, Spain)
- APAC: 36% (Singapore, Japan, Australia, South Korea, India)
- North America: 27% (USA, Canada)

---

## Styling & Theme

**Colors:**
- Background: `bg-bitcoin-dark/40` with `backdrop-blur-sm`
- Border: `border-bitcoin-gray/20`
- Primary accent: `bitcoin-orange` (#F7931A)
- Regional colors: Orange (LATAM), Blue (EU), Green (APAC), Purple (NA)

**Conversion Rate Color Coding:**
- **Green** (`text-green-400`): ≥15% conversion rate
- **Gold** (`text-bitcoin-gold`): 10-14.9% conversion rate  
- **Red** (`text-red-400`): <10% conversion rate

**Bitcoin Theme Integration:**
- Gradient text: `bitcoin-gradient-text`
- Shadow: `shadow-bitcoin`
- Hover effects: `hover:border-bitcoin-orange/30`

---

## Translation Keys

**Location:** `src/assets/i18n/en.json`

```json
{
  "admin": {
    "analytics": {
      "future_items": {
        "geo": {
          "title": "Geographic breakdowns",
          "description": "Heatmaps of quote requests and conversions to pinpoint expansion opportunities across LATAM, EU, and APAC.",
          "status": "admin.analytics.future_status.internal_beta"
        }
      },
      "future_status": {
        "internal_beta": "Internal beta"
      }
    }
  }
}
```

---

## Performance Considerations

**Optimizations:**
1. **Lazy Loading:** Geographic data only loads when `showGeoMap = true`
2. **Parallel Queries:** Uses `Promise.all()` to fetch quotes and orders simultaneously
3. **Map Aggregation:** Client-side aggregation using JavaScript `Map` for O(n) performance
4. **SVG Rendering:** Pure SVG (no canvas) for crisp scaling and low memory usage

**Firestore Queries:**
- Both queries use indexed `createdAt` field
- Composite index recommended: `createdAt ASC, status ASC`

---

## Future Enhancements

### Phase 1 (Current Beta)
- [x] Interactive world map heatmap
- [x] Quote and conversion tracking by country
- [x] Regional summary statistics
- [x] Hover tooltips with detailed metrics

### Phase 2 (Planned)
- [ ] Export to CSV functionality
- [ ] Drill-down to city-level data
- [ ] Time-series animation (watch regions grow over time)
- [ ] Predictive analytics for expansion opportunities

### Phase 3 (Future)
- [ ] Integration with Google Analytics geographic data
- [ ] Automated alerts for emerging markets
- [ ] Competitor presence mapping
- [ ] Energy cost overlays (mining profitability by region)

---

## Troubleshooting

**No data showing on map:**
1. Check if `quotes` collection exists in Firestore
2. Verify `countryCode` field is present on orders/quotes
3. Check console for Firestore permission errors
4. Ensure period filter includes dates with data

**Incorrect country mapping:**
1. Verify `countryCode` uses ISO 3166-1 alpha-2 format (2 letters)
2. Add missing countries to `countryCoordinates` in `geo-heatmap.component.ts`
3. Update `getRegion()` method if new regions needed

**Performance issues:**
1. Reduce seed data volume for testing
2. Add Firestore composite indexes
3. Consider pagination for large datasets (>1000 records)

---

## Dependencies

**No External Libraries Required!**

All components built with:
- Angular 17+ standalone components
- Native SVG rendering
- TypeScript for type safety
- Firebase/Firestore for data

---

## Testing

### Manual Testing Checklist
- [ ] Load `/admin/analytics` page
- [ ] Select different time periods (today/week/month/year)
- [ ] Hover over country data points (tooltips should appear)
- [ ] Verify regional stats match heatmap data
- [ ] Check conversion rate color coding (green/gold/red)
- [ ] Test with empty data (graceful degradation)
- [ ] Verify mobile responsiveness

### Unit Testing (TODO)
```typescript
// Example test case
it('should calculate regional stats correctly', () => {
  const component = new AnalyticsAdminComponent();
  component.geoData = [
    { country: 'Brazil', countryCode: 'BR', region: 'LATAM', quotes: 50, conversions: 10, revenue: 35000 },
    { country: 'Mexico', countryCode: 'MX', region: 'LATAM', quotes: 30, conversions: 5, revenue: 14000 }
  ];
  
  const stats = component.getRegionStats('LATAM');
  expect(stats?.quotes).toBe(80);
  expect(stats?.conversions).toBe(15);
  expect(stats?.rate).toBeCloseTo(18.75, 1);
});
```

---

## Related Files

- `src/app/shared/components/geo-heatmap/geo-heatmap.component.ts`
- `src/app/services/admin-dashboard.service.ts`
- `src/app/pages/admin/analytics/analytics-admin.page.ts`
- `src/app/pages/admin/analytics/analytics-admin.page.html`
- `src/assets/i18n/en.json`
- `scripts/seed-geo-data.ts`

---

## Support

For questions or issues:
1. Check Firestore console for data structure
2. Review browser console for errors
3. Verify feature flag: `showGeoMap = true`
4. Test with seed data script first

**Last Updated:** 2025-11-18  
**Version:** 1.0.0-beta  
**Author:** GitHub Copilot
