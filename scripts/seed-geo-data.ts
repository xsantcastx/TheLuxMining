/**
 * Seed Geographic Data Script
 * 
 * This script adds sample quote requests and orders with country data
 * to demonstrate the geographic heatmap feature in analytics.
 * 
 * Run with: npx ts-node scripts/seed-geo-data.ts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';

// Sample countries with realistic distribution
const sampleCountries = [
  // LATAM (high volume)
  { code: 'BR', name: 'Brazil', weight: 20 },
  { code: 'MX', name: 'Mexico', weight: 15 },
  { code: 'AR', name: 'Argentina', weight: 10 },
  { code: 'CL', name: 'Chile', weight: 8 },
  { code: 'CO', name: 'Colombia', weight: 7 },
  
  // Europe (medium volume)
  { code: 'GB', name: 'United Kingdom', weight: 12 },
  { code: 'DE', name: 'Germany', weight: 11 },
  { code: 'FR', name: 'France', weight: 8 },
  { code: 'NL', name: 'Netherlands', weight: 6 },
  { code: 'ES', name: 'Spain', weight: 5 },
  
  // APAC (growing volume)
  { code: 'SG', name: 'Singapore', weight: 10 },
  { code: 'JP', name: 'Japan', weight: 8 },
  { code: 'AU', name: 'Australia', weight: 7 },
  { code: 'KR', name: 'South Korea', weight: 6 },
  { code: 'IN', name: 'India', weight: 5 },
  
  // North America
  { code: 'US', name: 'United States', weight: 18 },
  { code: 'CA', name: 'Canada', weight: 9 }
];

function getRandomCountry(): { code: string; name: string } {
  const totalWeight = sampleCountries.reduce((sum, c) => sum + c.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const country of sampleCountries) {
    random -= country.weight;
    if (random <= 0) {
      return { code: country.code, name: country.name };
    }
  }
  
  return sampleCountries[0];
}

function getRandomDate(daysAgo: number): Date {
  const now = new Date();
  const randomDays = Math.random() * daysAgo;
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
}

async function seedGeoData() {
  try {
    // Initialize Firebase Admin
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    const serviceAccount = require(serviceAccountPath) as ServiceAccount;

    initializeApp({
      credential: cert(serviceAccount)
    });

    const db = getFirestore();
    console.log('🔥 Connected to Firestore');

    // Generate quote requests (100 total)
    console.log('\n📊 Generating quote requests...');
    const quoteBatch = db.batch();
    const quoteCount = 100;

    for (let i = 0; i < quoteCount; i++) {
      const country = getRandomCountry();
      const quoteRef = db.collection('quotes').doc();
      
      quoteBatch.set(quoteRef, {
        country: country.name,
        countryCode: country.code,
        email: `customer${i}@example.com`,
        message: `Interested in mining hardware for ${country.name} deployment`,
        createdAt: Timestamp.fromDate(getRandomDate(30)),
        status: 'pending'
      });

      if ((i + 1) % 20 === 0) {
        console.log(`  Created ${i + 1}/${quoteCount} quotes`);
      }
    }

    await quoteBatch.commit();
    console.log(`✅ Created ${quoteCount} quote requests`);

    // Generate orders (conversions) - about 15% conversion rate
    console.log('\n💰 Generating orders (conversions)...');
    const orderBatch = db.batch();
    const orderCount = 15;
    const products = [
      { id: 'antminer-s19-pro', name: 'Antminer S19 Pro', price: 3500 },
      { id: 'whatsminer-m30s', name: 'WhatsMiner M30S+', price: 2800 },
      { id: 'antminer-s21', name: 'Antminer S21', price: 5200 }
    ];

    for (let i = 0; i < orderCount; i++) {
      const country = getRandomCountry();
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const orderRef = db.collection('orders').doc();
      
      orderBatch.set(orderRef, {
        orderNumber: `ORD-${Date.now()}-${i}`,
        country: country.name,
        countryCode: country.code,
        shippingAddress: {
          country: country.name,
          countryCode: country.code,
          city: 'Sample City',
          postalCode: '12345'
        },
        items: [{
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: quantity
        }],
        total: product.price * quantity,
        totalAmount: product.price * quantity,
        status: 'completed',
        createdAt: Timestamp.fromDate(getRandomDate(30)),
        updatedAt: Timestamp.fromDate(getRandomDate(7))
      });

      if ((i + 1) % 5 === 0) {
        console.log(`  Created ${i + 1}/${orderCount} orders`);
      }
    }

    await orderBatch.commit();
    console.log(`✅ Created ${orderCount} completed orders`);

    console.log('\n🎉 Geographic data seeding complete!');
    console.log('\n📈 Summary:');
    console.log(`   - ${quoteCount} quote requests across ${sampleCountries.length} countries`);
    console.log(`   - ${orderCount} completed orders (~15% conversion rate)`);
    console.log('   - Data spread across LATAM, EU, APAC, and NA regions');
    console.log('\n💡 View the heatmap at: /admin/analytics');

  } catch (error) {
    console.error('❌ Error seeding geographic data:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seeder
seedGeoData();
