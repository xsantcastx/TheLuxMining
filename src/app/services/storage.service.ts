import { Injectable, inject } from '@angular/core';
import { Storage, ref, uploadBytesResumable, getDownloadURL, deleteObject, UploadTaskSnapshot } from '@angular/fire/storage';
import { Observable, from, map } from 'rxjs';
import { ImageOptimizationService } from './image-optimization.service';
import { VideoOptimizationService } from './video-optimization.service';

export interface UploadProgress {
  progress: number;
  downloadURL?: string;
  thumbnailURL?: string;
  error?: string;
  optimizing?: boolean;
  mediaType?: 'image' | 'video';
  duration?: number; // For videos
  dimensions?: { width: number; height: number };
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage = inject(Storage);
  private imageOptimizer = inject(ImageOptimizationService);
  private videoOptimizer = inject(VideoOptimizationService);

  /**
   * Upload an optimized image - ONLY WebP format to save storage
   * @param file - The image file to upload
   * @param path - The storage path (without extension)
   * @param optimize - Whether to optimize the image (default: true)
   * @returns Observable that emits upload progress and final URLs
   */
  uploadOptimizedImage(file: File, path: string, optimize: boolean = true): Observable<UploadProgress> {
    return new Observable(observer => {
      (async () => {
        try {
          // Notify that optimization is starting
          if (optimize) {
            observer.next({ progress: 0, optimizing: true, mediaType: 'image' });
          }

          let webpBlob: Blob;
          let thumbnailBlob: Blob | undefined;
          let dimensions = { width: 0, height: 0 };
          
          // Optimize image if requested
          if (optimize) {
            const optimized = await this.imageOptimizer.optimizeImage(file, {
              maxWidth: 1920,
              maxHeight: 1080,
              quality: 0.85,
              createThumbnail: true,
              thumbnailSize: 400
            });

            // Use WebP format ONLY to save storage space
            webpBlob = optimized.webp || optimized.original;
            thumbnailBlob = optimized.thumbnailWebp || optimized.thumbnail;
            dimensions = { width: optimized.width, height: optimized.height };

            console.log('Image optimized (WebP only):', {
              originalSize: `${this.imageOptimizer.getFileSizeMB(file).toFixed(2)}MB`,
              webpSize: `${this.imageOptimizer.getFileSizeMB(webpBlob).toFixed(2)}MB`,
              dimensions: `${optimized.width}x${optimized.height}`,
              savings: `${((1 - webpBlob.size / file.size) * 100).toFixed(1)}%`
            });
          } else {
            webpBlob = file;
          }

          observer.next({ progress: 10, optimizing: false, mediaType: 'image' });

          // Upload main image as WebP
          const mainPath = `${path}.webp`;
          const mainURL = await this.uploadBlob(webpBlob, mainPath, observer, 10, 60);

          // Upload thumbnail if available
          let thumbnailURL: string | undefined;
          if (thumbnailBlob) {
            const thumbPath = `${path}-thumb.webp`;
            thumbnailURL = await this.uploadBlob(thumbnailBlob, thumbPath, observer, 60, 100);
          }

          // Complete
          observer.next({
            progress: 100,
            downloadURL: mainURL,
            thumbnailURL,
            mediaType: 'image',
            dimensions
          });
          observer.complete();
        } catch (error: any) {
          console.error('Upload error:', error);
          observer.next({ progress: 0, error: error.message, mediaType: 'image' });
          observer.error(error);
        }
      })();
    });
  }

  /**
   * Upload a blob to Firebase Storage
   * @param blob - The blob to upload
   * @param path - The storage path
   * @param observer - The observer to notify progress
   * @param startProgress - Starting progress percentage
   * @param endProgress - Ending progress percentage
   * @returns Promise with download URL
   */
  private uploadBlob(
    blob: Blob,
    path: string,
    observer: any,
    startProgress: number,
    endProgress: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const storageRef = ref(this.storage, path);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes);
          const totalProgress = startProgress + (fileProgress * (endProgress - startProgress));
          observer.next({ progress: totalProgress });
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Upload a file to Firebase Storage with progress tracking
   * @param file - The file to upload
   * @param path - The storage path (e.g., 'products/12mm/image.jpg')
   * @returns Observable that emits upload progress and final download URL
   */
  uploadFile(file: File, path: string): Observable<UploadProgress> {
    return new Observable(observer => {
      const storageRef = ref(this.storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          // Calculate progress percentage
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next({ progress });
        },
        (error) => {
          // Handle upload error
          console.error('Upload error:', error);
          observer.next({ progress: 0, error: error.message });
          observer.error(error);
        },
        async () => {
          // Upload completed successfully, get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            observer.next({ progress: 100, downloadURL });
            observer.complete();
          } catch (error: any) {
            console.error('Error getting download URL:', error);
            observer.error(error);
          }
        }
      );
    });
  }

  /**
   * Upload product image with automatic optimization
   * @param file - The image file
   * @param productSlug - The product slug for the path
   * @returns Observable with upload progress and URLs
   */
  uploadProductImage(file: File, productSlug: string): Observable<UploadProgress> {
    const timestamp = Date.now();
    const pathWithoutExt = `products/${productSlug}-${timestamp}`;
    return this.uploadOptimizedImage(file, pathWithoutExt);
  }

  /**
   * Upload gallery image with automatic optimization
   * @param file - The image file
   * @param category - The gallery category (kitchens, bathrooms, etc.)
   * @returns Observable with upload progress and URLs
   */
  uploadGalleryImage(file: File, category: string): Observable<UploadProgress> {
    const timestamp = Date.now();
    const pathWithoutExt = `gallery/${category}/${timestamp}`;
    return this.uploadOptimizedImage(file, pathWithoutExt);
  }

  /**
   * Upload video with automatic optimization and thumbnail generation
   * @param file - The video file to upload
   * @param path - The storage path (without extension)
   * @returns Observable that emits upload progress and final URLs
   */
  uploadOptimizedVideo(file: File, path: string): Observable<UploadProgress> {
    return new Observable(observer => {
      (async () => {
        try {
          observer.next({ progress: 0, optimizing: true, mediaType: 'video' });

          // Optimize video and generate thumbnail
          const optimized = await this.videoOptimizer.optimizeVideo(file, {
            maxWidth: 1920,
            maxHeight: 1080,
            maxDuration: 60,
            thumbnailTime: 1
          });

          console.log('Video optimized:', {
            originalSize: `${this.videoOptimizer.getFileSizeMB(file).toFixed(2)}MB`,
            duration: `${optimized.duration.toFixed(2)}s`,
            dimensions: `${optimized.width}x${optimized.height}`,
            format: optimized.format
          });

          observer.next({ progress: 10, optimizing: false, mediaType: 'video' });

          // Upload video (MP4/WebM format)
          const videoExt = optimized.format === 'webm' ? '.webm' : '.mp4';
          const videoPath = `${path}${videoExt}`;
          const videoURL = await this.uploadBlob(optimized.compressed, videoPath, observer, 10, 70);

          // Upload thumbnail as WebP
          let thumbnailURL: string | undefined;
          if (optimized.thumbnailWebp || optimized.thumbnail) {
            const thumbBlob = optimized.thumbnailWebp || optimized.thumbnail;
            const thumbPath = `${path}-thumb.webp`;
            thumbnailURL = await this.uploadBlob(thumbBlob, thumbPath, observer, 70, 100);
          }

          // Complete
          observer.next({
            progress: 100,
            downloadURL: videoURL,
            thumbnailURL,
            mediaType: 'video',
            duration: optimized.duration,
            dimensions: { width: optimized.width, height: optimized.height }
          });
          observer.complete();
        } catch (error: any) {
          console.error('Video upload error:', error);
          observer.next({ progress: 0, error: error.message, mediaType: 'video' });
          observer.error(error);
        }
      })();
    });
  }

  /**
   * Upload product video with automatic optimization
   * @param file - The video file
   * @param productSlug - The product slug for the path
   * @returns Observable with upload progress and URLs
   */
  uploadProductVideo(file: File, productSlug: string): Observable<UploadProgress> {
    const timestamp = Date.now();
    const pathWithoutExt = `products/${productSlug}-video-${timestamp}`;
    return this.uploadOptimizedVideo(file, pathWithoutExt);
  }

  /**
   * Upload gallery video with automatic optimization
   * @param file - The video file
   * @param category - The gallery category
   * @returns Observable with upload progress and URLs
   */
  uploadGalleryVideo(file: File, category: string): Observable<UploadProgress> {
    const timestamp = Date.now();
    const pathWithoutExt = `gallery/${category}/video-${timestamp}`;
    return this.uploadOptimizedVideo(file, pathWithoutExt);
  }

  /**
   * Delete a file from Firebase Storage
   * @param downloadURL - The download URL of the file to delete
   * @returns Promise that resolves when the file is deleted
   */
  async deleteFile(downloadURL: string): Promise<void> {
    try {
      // Extract the path from the download URL
      const path = this.getPathFromURL(downloadURL);
      if (!path) {
        throw new Error('Invalid download URL');
      }

      const fileRef = ref(this.storage, path);
      await deleteObject(fileRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Extract storage path from download URL
   * @param url - The download URL
   * @returns The storage path or null
   */
  private getPathFromURL(url: string): string | null {
    try {
      // Firebase Storage URLs follow this pattern:
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1]);
      }
      return null;
    } catch (error) {
      console.error('Error parsing URL:', error);
      return null;
    }
  }

  /**
   * Validate image file
   * @param file - The file to validate
   * @param maxSizeMB - Maximum file size in MB (default 5MB)
   * @returns Validation result
   */
  validateImageFile(file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPG, PNG, and WebP images are allowed' };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    return { valid: true };
  }

  /**
   * Validate video file
   * @param file - The file to validate
   * @param maxSizeMB - Maximum file size in MB (default 50MB)
   * @returns Promise with validation result
   */
  async validateVideoFile(file: File, maxSizeMB: number = 50): Promise<{ valid: boolean; error?: string }> {
    return this.videoOptimizer.validateVideoFile(file, maxSizeMB, 60);
  }

  /**
   * Validate media file (image or video)
   * @param file - The file to validate
   * @returns Promise with validation result
   */
  async validateMediaFile(file: File): Promise<{ valid: boolean; error?: string; type: 'image' | 'video' }> {
    // Check if it's an image
    if (file.type.startsWith('image/')) {
      const result = this.validateImageFile(file, 5);
      return { ...result, type: 'image' };
    }
    
    // Check if it's a video
    if (file.type.startsWith('video/')) {
      const result = await this.validateVideoFile(file, 50);
      return { ...result, type: 'video' };
    }

    return { valid: false, error: 'File must be an image or video', type: 'image' };
  }

  /**
   * Generate a slug from a name
   * @param name - The name to slugify
   * @returns The slug
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
}
