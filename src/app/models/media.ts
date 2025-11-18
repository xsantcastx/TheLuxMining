/**
 * Media Model
 * Represents uploaded media (images, videos) with metadata and storage references
 * Used by: Products (cover + gallery), Gallery Admin
 */

export interface Media {
  /** Firestore document ID */
  id?: string;

  /** Full-size image URL from Firebase Storage */
  url: string;

  /** Thumbnail URL (300x300 or similar) - optional, can be generated later */
  thumbnailUrl?: string;

  /** Original filename */
  filename: string;

  /** Storage path for deletion (e.g., 'products/cover/abc123.jpg') */
  storagePath: string;

  /** Image dimensions */
  width: number;
  height: number;

  /** File size in bytes */
  size: number;

  /** MIME type (e.g., 'image/jpeg', 'image/png', 'video/mp4') */
  mimeType: string;

  /** Media type (image or video) */
  mediaType?: 'image' | 'video';

  /** Upload timestamp */
  uploadedAt: Date;

  /** User ID who uploaded the file */
  uploadedBy: string;

  /** Tags for categorization (e.g., 'cover', 'detail', 'ambient', 'lifestyle') */
  tags: string[];

  /** Alt text for accessibility */
  altText?: string;

  /** Caption or description */
  caption?: string;

  /** Related entity IDs (products, gallery items, etc.) */
  relatedEntityIds?: string[];

  /** Related entity type (e.g., 'product', 'gallery') */
  relatedEntityType?: 'product' | 'gallery' | 'other';
}

/**
 * Media creation input (before Firestore ID assigned)
 */
export interface MediaCreateInput {
  url: string;
  thumbnailUrl?: string;
  filename: string;
  storagePath: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  mediaType?: 'image' | 'video';
  uploadedBy: string;
  tags: string[];
  altText?: string;
  caption?: string;
  relatedEntityIds?: string[];
  relatedEntityType?: 'product' | 'gallery' | 'other';
}

/**
 * Media validation constants
 */
export const MEDIA_VALIDATION = {
  /** Minimum image width in pixels (flexible for various image sizes) */
  MIN_WIDTH: 400,

  /** Minimum image height in pixels (flexible for various image sizes) */
  MIN_HEIGHT: 400,

  /** Maximum file size in bytes (10MB) */
  MAX_SIZE: 10 * 1024 * 1024,

  /** Allowed MIME types */
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'],

  /** Gallery category tags (for gallery images) */
  GALLERY_TAGS: ['kitchen', 'bathroom', 'facade', 'industrial', 'other'] as const,
  
  /** Product media tags (for product images) */
  PRODUCT_TAGS: ['cover', 'detail', 'ambient', 'lifestyle', 'installation', 'closeup'] as const,
} as const;

/**
 * Media tag type (for type safety)
 */
export type MediaTag = typeof MEDIA_VALIDATION.GALLERY_TAGS[number] | typeof MEDIA_VALIDATION.PRODUCT_TAGS[number] | string;

/**
 * Array of gallery tags for UI rendering
 */
export const GALLERY_TAGS = MEDIA_VALIDATION.GALLERY_TAGS as unknown as MediaTag[];

/**
 * Array of product tags for UI rendering
 */
export const PRODUCT_TAGS = MEDIA_VALIDATION.PRODUCT_TAGS as unknown as MediaTag[];
