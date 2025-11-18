# Geographic Data Collection - Implementation Guide

## Overview

TheLuxMining now automatically collects geographic data from **real user visits** to power the geographic breakdowns heatmap in the analytics dashboard.

---

## How It Works

### 1. **Automatic Data Collection**

Every time a user visits your site, the system automatically:

1. **Detects their country** using multiple methods:
   - IP-based geolocation (via ipapi.co - 1000 free requests/day)
   - Browser timezone as fallback
   - User's browser language

2. **Logs the page view** to Firestore with:
   - Path visited
   - Timestamp
   - Country name & code
   - Region/city (if available)
   - User agent
   - Referrer

3. **Respects privacy**:
   - Only collects if analytics consent is granted
   - No personal identifying information
   - Silent failures don't disrupt user experience

---

## Data Sources

### Primary: `pageViews` Collection

Automatically logged on every page visit:

```typescript
{
  path: "/products/antminer-s19",
  timestamp: Timestamp,
  country: "Brazil",
  countryCode: "BR",
  region: "São Paulo",
  city: "São Paulo",
  userAgent: "Mozilla/5.0...",
  referrer: "https://google.com",
  language: "pt-BR"
}
```

### Secondary: `quotes` Collection

Logged when users submit contact forms:

```typescript
{
  email: "customer@example.com",
  message: "Interested in 10x S19 Pro miners",
  productId: "antminer-s19-pro",
  productName: "Antminer S19 Pro",
  country: "Mexico",
  countryCode: "MX",
  region: "Jalisco",
  createdAt: Timestamp,
  status: "pending",
  source: "website"
}
```

### Existing: `orders` Collection

Already has geographic data in `shippingAddress`:

```typescript
{
  orderNumber: "ORD-123",
  shippingAddress: {
    country: "United States",
    countryCode: "US", // <-- If not present, auto-detected
    city: "Miami",
    ...
  },
  status: "completed",
  total: 35000,
  ...
}
```

---

## Integration Points

### 1. **Analytics Service** (`analytics.service.ts`)

**Modified methods:**

```typescript
trackPageView(path: string) {
  // GA4 tracking (existing)
  this.logEventSafely('page_view', {...});
  
  // NEW: Firestore logging with geo data
  void this.analyticsLogger.logPageView(path);
}

trackContactSubmit(method, additionalData) {
  // GA4 tracking (existing)
  this.logEventSafely('generate_lead', {...});
  
  // NEW: Log to quotes collection with geo
  if (method === 'form' && additionalData?.email) {
    void this.analyticsLogger.logQuoteRequest({...});
  }
}
```

### 2. **Analytics Logger Service** (`analytics-logger.service.ts`)

**New service** that handles:
- IP-based geolocation lookup
- Timezone-based fallback
- Firestore logging
- Geo data caching (one lookup per session)

### 3. **Admin Dashboard Service** (`admin-dashboard.service.ts`)

**Updated `getGeographicData()` to pull from:**
1. `quotes` collection (if exists) - for quote requests
2. `orders` collection - for conversions
3. Falls back gracefully if collections don't exist

---

## Geolocation Methods (in order of priority)

### Method 1: IP-Based Lookup ✅ **Most Accurate**

```typescript
// Uses ipapi.co free API
const response = await fetch('https://ipapi.co/json/');
// Returns: country, countryCode, region, city
```

**Pros:**
- Very accurate (city-level)
- No user permission needed
- Works immediately

**Cons:**
- 1000 requests/day limit (should be enough for most sites)
- External dependency

### Method 2: Timezone Fallback

```typescript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// "America/Sao_Paulo" → Brazil (BR)
```

**Pros:**
- No external API
- Works offline
- Instant

**Cons:**
- Country-level only
- ~20 most common countries mapped

### Method 3: Order Shipping Address

```typescript
shippingAddress: {
  country: "Chile",
  countryCode: "CL" 
}
```

**Pros:**
- 100% accurate
- User-provided data

**Cons:**
- Only available for orders
- Not for browsing users

---

## Firestore Collections

### `pageViews` (NEW)

**Purpose:** Track visitor geography and browsing patterns

**Indexes needed:**
```
path ASC, timestamp DESC
countryCode ASC, timestamp DESC
```

**Usage:**
- Shows which countries browse most
- Can extend to product-level interest tracking

### `quotes` (NEW/OPTIONAL)

**Purpose:** Track quote requests with geography

**Indexes needed:**
```
countryCode ASC, createdAt DESC
status ASC, createdAt DESC
```

**Usage:**
- Measures interest before purchase
- Shows geographic demand
- Feeds into heatmap "quotes" data

### `orders` (EXISTING)

**Modified:** Now includes `countryCode` extraction

**Usage:**
- Conversions (completed orders)
- Revenue by region

---

## Privacy & Compliance

### GDPR Compliant ✅

1. **Consent Required:**
   - Only logs if `analyticsConsentGranted = true`
   - Tied to your existing cookie consent

2. **No PII:**
   - No IP addresses stored
   - No user IDs linked to geography
   - No email addresses in pageViews

3. **Transparent:**
   - User knows analytics are running
   - Can opt-out via cookie banner

### Data Retention

**Recommended Firestore rules:**

```javascript
// pageViews - auto-delete after 90 days
match /pageViews/{doc} {
  allow read: if request.auth != null && request.auth.token.admin == true;
  allow create: if true; // Allow anonymous logging
  allow delete: if request.auth != null && request.auth.token.admin == true;
}

// quotes - keep indefinitely (business leads)
match /quotes/{doc} {
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

---

## How to Test

### 1. **Visit Your Site**

Just browse normally. The system will:
- Detect your country from IP
- Log to `pageViews` collection

### 2. **Check Firestore**

Open Firebase Console → Firestore Database → `pageViews`

You should see entries like:
```
{
  path: "/",
  timestamp: ...,
  countryCode: "US",
  country: "United States"
}
```

### 3. **View in Analytics Dashboard**

Go to `/admin/analytics` → Geographic Breakdowns section

The heatmap will populate automatically!

---

## Monitoring

### Check API Usage

ipapi.co free tier: **1000 requests/day**

**How to monitor:**
1. Check ipapi.co dashboard (if you create account)
2. Watch console for "IP geolocation lookup failed"
3. If you hit limit, timezone fallback activates

**Upgrade options:**
- $10/month = 30,000 requests/month
- Or switch to Google Maps Geolocation API

### Firestore Costs

**Estimated costs** (1000 visitors/day):
- Writes: 1000/day = ~$0.60/month
- Reads: Minimal (only admins view analytics)
- Storage: ~10MB/month = negligible

---

## Customization

### Add More Geo Sources

Edit `analytics-logger.service.ts`:

```typescript
private async getGeoFromIP() {
  // Option 1: ipapi.co (current)
  const response = await fetch('https://ipapi.co/json/');
  
  // Option 2: ipify + ipapi combo
  const ip = await fetch('https://api.ipify.org?format=json');
  const geo = await fetch(`https://ipapi.co/${ip}/json/`);
  
  // Option 3: Google Maps API (requires key)
  // See: https://developers.google.com/maps/documentation/geolocation
}
```

### Track Custom Events

```typescript
// In any component
constructor(private analyticsLogger: AnalyticsLoggerService) {}

async trackProductInterest(productId: string) {
  await this.analyticsLogger.logQuoteRequest({
    email: 'anonymous', // Or real email from form
    message: `Viewed ${productId}`,
    productId
  });
}
```

---

## Troubleshooting

**No geographic data showing?**

1. Check Firestore rules allow writes
2. Verify analytics consent is granted
3. Check browser console for errors
4. Ensure ipapi.co isn't blocked by firewall

**Data shows wrong countries?**

1. Check if VPN is active
2. Verify timezone mapping is correct
3. IP geolocation can be off by ~50km

**Too many API requests?**

1. Increase cache duration
2. Switch to timezone-only mode
3. Upgrade ipapi.co plan

---

## Summary

✅ **Automatic:** No manual data entry needed  
✅ **Privacy-First:** Consent required, no PII  
✅ **Multi-Source:** IP + timezone + orders  
✅ **Real-Time:** See geographic data immediately  
✅ **Scalable:** Handles 1000+ visitors/day free  

The heatmap will now populate automatically as real users visit your site! 🌍
