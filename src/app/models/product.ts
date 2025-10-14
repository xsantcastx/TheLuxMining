import { Timestamp } from '@angular/fire/firestore';

export interface Product {
  id?: string;             // Firestore document ID
  name: string;            // "Saint Laurent"
  slug: string;            // "saint-laurent" (URL-friendly)
  grosor: '12mm' | '15mm' | '20mm';  // Thickness
  size: string;            // e.g., "160×320cm"
  imageUrl: string;        // Main product image URL (legacy or computed from coverImage)
  description?: string;    // Product description
  price?: number;          // Price per unit
  stock?: number;          // Available stock
  sku?: string;            // SKU code
  features?: string[];     // Product features
  active?: boolean;        // Is product active/visible
  status?: 'draft' | 'published' | 'archived';
  categoryId?: string;     // Reference to category document
  materialId?: string;     // Reference to material document
  search_name?: string;    // Lowercase name for search (auto-generated)
  variantMode?: 'embedded' | 'referenced';
  variants?: ProductVariant[];
  specs?: ProductSpecs;
  coverImage?: string;     // Media ID or legacy URL
  galleryImageIds?: string[];  // Array of media IDs
  tags?: string[];
  seo?: {
    title?: string;
    metaDescription?: string;
    ogImage?: string;
  };
  descriptionLocked?: boolean;
  specsLocked?: boolean;
  seoLocked?: boolean;
  createdAt?: Timestamp;   // Creation timestamp
  updatedAt?: Timestamp;   // Last update timestamp
}

export interface ProductVariant {
  sku?: string;
  finish?: string;
  price?: number | null;
  stock?: number;
  active?: boolean;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface CartState {
  items: CartItem[];
}

export interface ProductSpecs {
  grosor?: '12mm' | '15mm' | '20mm';
  size?: string;
  finish?: string;
  thicknessMm?: number;
  usage?: string[];
  [key: string]: any;
}
