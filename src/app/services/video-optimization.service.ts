import { Injectable } from '@angular/core';

export interface OptimizedVideo {
  compressed: Blob;
  thumbnail: Blob;
  thumbnailWebp?: Blob;
  duration: number;
  width: number;
  height: number;
  format: string;
}

export interface VideoCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxDuration?: number; // seconds
  targetBitrate?: number; // kbps
  thumbnailTime?: number; // seconds - when to capture thumbnail
}

@Injectable({
  providedIn: 'root'
})
export class VideoOptimizationService {

  /**
   * Optimize a video: compress, resize, and generate thumbnail
   * Note: This uses browser APIs and is limited. For production, consider server-side processing.
   * @param file - The video file to optimize
   * @param options - Optimization options
   * @returns Promise with optimized video and metadata
   */
  async optimizeVideo(
    file: File,
    options: VideoCompressionOptions = {}
  ): Promise<OptimizedVideo> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      maxDuration = 60, // Max 60 seconds by default
      thumbnailTime = 1 // Capture thumbnail at 1 second
    } = options;

    try {
      // Load video metadata
      const video = await this.loadVideo(file);
      
      // Check duration
      if (video.duration > maxDuration) {
        throw new Error(`Video duration exceeds ${maxDuration} seconds. Please upload a shorter video.`);
      }

      // Calculate dimensions maintaining aspect ratio
      const dimensions = this.calculateDimensions(
        video.videoWidth,
        video.videoHeight,
        maxWidth,
        maxHeight
      );

      // Generate thumbnail at specified time
      video.currentTime = Math.min(thumbnailTime, video.duration);
      await new Promise(resolve => {
        video.onseeked = resolve;
      });

      const thumbnailBlob = await this.captureThumbnail(video, dimensions.width, dimensions.height);
      
      // Try to create WebP thumbnail
      let thumbnailWebpBlob: Blob | undefined;
      try {
        thumbnailWebpBlob = await this.captureThumbnailWebP(video, dimensions.width, dimensions.height);
      } catch (error) {
        console.warn('WebP thumbnail not supported');
      }

      // For video compression, we'll use the original file
      // Browser APIs don't support video re-encoding
      // In production, this should be done server-side with FFmpeg
      console.log('Video optimization:', {
        originalSize: `${this.getFileSizeMB(file).toFixed(2)}MB`,
        duration: `${video.duration.toFixed(2)}s`,
        dimensions: `${video.videoWidth}x${video.videoHeight}`,
        targetDimensions: `${dimensions.width}x${dimensions.height}`
      });

      // Clean up
      URL.revokeObjectURL(video.src);

      return {
        compressed: file, // Browser can't re-encode, return original
        thumbnail: thumbnailBlob,
        thumbnailWebp: thumbnailWebpBlob,
        duration: video.duration,
        width: dimensions.width,
        height: dimensions.height,
        format: this.getVideoFormat(file)
      };
    } catch (error) {
      console.error('Error optimizing video:', error);
      throw error;
    }
  }

  /**
   * Load a video file into an HTMLVideoElement
   */
  private loadVideo(file: File): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve(video);
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate new dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let newWidth = width;
    let newHeight = height;

    if (width > maxWidth || height > maxHeight) {
      const widthRatio = maxWidth / width;
      const heightRatio = maxHeight / height;
      const ratio = Math.min(widthRatio, heightRatio);

      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    return { width: newWidth, height: newHeight };
  }

  /**
   * Capture a thumbnail from video as JPEG
   */
  private captureThumbnail(
    video: HTMLVideoElement,
    width: number,
    height: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw video frame
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        },
        'image/jpeg',
        0.85
      );
    });
  }

  /**
   * Capture a thumbnail from video as WebP
   */
  private captureThumbnailWebP(
    video: HTMLVideoElement,
    width: number,
    height: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw video frame
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create WebP thumbnail'));
          }
        },
        'image/webp',
        0.85
      );
    });
  }

  /**
   * Get file size in MB
   */
  getFileSizeMB(blob: Blob): number {
    return blob.size / (1024 * 1024);
  }

  /**
   * Get video format/codec
   */
  private getVideoFormat(file: File): string {
    if (file.type.includes('mp4')) return 'mp4';
    if (file.type.includes('webm')) return 'webm';
    if (file.type.includes('ogg')) return 'ogg';
    return 'unknown';
  }

  /**
   * Validate video file
   * @param file - The file to validate
   * @param maxSizeMB - Maximum file size in MB (default 50MB)
   * @param maxDuration - Maximum duration in seconds (default 60s)
   * @returns Validation result
   */
  async validateVideoFile(
    file: File,
    maxSizeMB: number = 50,
    maxDuration: number = 60
  ): Promise<{ valid: boolean; error?: string }> {
    // Check file type
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: 'Only MP4, WebM, and OGG videos are allowed' };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    // Check duration
    try {
      const video = await this.loadVideo(file);
      if (video.duration > maxDuration) {
        URL.revokeObjectURL(video.src);
        return { valid: false, error: `Video duration must be less than ${maxDuration} seconds` };
      }
      URL.revokeObjectURL(video.src);
    } catch (error) {
      return { valid: false, error: 'Failed to load video metadata' };
    }

    return { valid: true };
  }

  /**
   * Check if browser supports WebM format
   */
  supportsWebM(): boolean {
    const video = document.createElement('video');
    return video.canPlayType('video/webm') !== '';
  }

  /**
   * Check if browser supports MP4 format
   */
  supportsMP4(): boolean {
    const video = document.createElement('video');
    return video.canPlayType('video/mp4') !== '';
  }

  /**
   * Get recommended video format for current browser
   */
  getRecommendedFormat(): 'mp4' | 'webm' {
    // WebM is more efficient but MP4 has better compatibility
    // Return MP4 as default for best compatibility
    return 'mp4';
  }
}
