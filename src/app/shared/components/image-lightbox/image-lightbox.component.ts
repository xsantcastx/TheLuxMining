import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LightboxImage {
  id?: string;
  url: string;
  altText?: string;
  thumbnailUrl?: string;
  caption?: string;
  mediaType?: 'image' | 'video';
}

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen && activeImage) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
        (click)="close()"
      >
        <button
          type="button"
          (click)="close()"
          class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          aria-label="Close lightbox"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        @if (hasMultipleImages) {
          <button
            type="button"
            (click)="prevImage($event)"
            class="absolute left-6 top-1/2 -translate-y-1/2 z-[60] w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Previous image"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            (click)="nextImage($event)"
            class="absolute right-6 top-1/2 -translate-y-1/2 z-[60] w-12 h-12 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Next image"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        }

        <div class="relative max-w-7xl max-h-[90vh] p-4 flex flex-col gap-4" (click)="$event.stopPropagation()">
          <div class="relative flex-1 flex items-center justify-center">
            @if (activeImage.mediaType === 'video') {
              <video
                [src]="activeImage.url"
                class="max-w-full max-h-[80vh] object-contain"
                controls
                autoplay>
              </video>
            } @else {
              <img
                [src]="activeImage.url"
                [alt]="activeAltText"
                class="max-w-full max-h-[80vh] object-contain"
                [style.transform]="'scale(' + zoomLevel + ')'"
                [style.transition]="'transform 0.3s ease'"
              />
            }

            @if (activeImage.mediaType !== 'video') {
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 rounded-lg p-2">
                <button
                  type="button"
                  (click)="zoomOut(); $event.stopPropagation()"
                  class="px-3 py-1 text-white hover:bg-white/20 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  [disabled]="zoomLevel <= 1"
                  aria-label="Zoom out"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <span class="px-3 py-1 text-white font-medium">{{ Math.round(zoomLevel * 100) }}%</span>
                <button
                  type="button"
                  (click)="zoomIn(); $event.stopPropagation()"
                  class="px-3 py-1 text-white hover:bg-white/20 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  [disabled]="zoomLevel >= 3"
                  aria-label="Zoom in"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>
              </div>
            }

            @if (hasMultipleImages) {
              <div class="absolute bottom-4 right-4 text-sm font-medium text-white bg-black/70 px-3 py-1 rounded-full">
                {{ activeIndexDisplay + 1 }} / {{ totalImages }}
              </div>
            }
          </div>

          @if (caption || activeAltText) {
            <div class="max-w-4xl mx-auto w-full">
              <div class="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10">
                @if (caption) {
                  <p class="text-white text-sm leading-relaxed mb-1">{{ caption }}</p>
                }
                @if (activeAltText && activeAltText !== caption) {
                  <p class="text-gray-300 text-xs">{{ activeAltText }}</p>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class ImageLightboxComponent {
  @Input() imageUrl: string = '';
  @Input() altText: string = '';
  @Input() caption: string = '';
  @Input() images: LightboxImage[] = [];
  @Input() currentIndex = 0;
  @Input() isOpen: boolean = false;

  @Output() currentIndexChange = new EventEmitter<number>();
  @Output() isOpenChange = new EventEmitter<boolean>();

  zoomLevel = 1;
  Math = Math;

  get totalImages(): number {
    return this.images.length || (this.imageUrl ? 1 : 0);
  }

  get hasMultipleImages(): boolean {
    return this.images.length > 1;
  }

  get activeIndexDisplay(): number {
    if (this.images.length > 0) {
      return this.normalizeIndex(this.currentIndex);
    }
    return 0;
  }

  get activeImage(): LightboxImage | null {
    if (this.images.length > 0) {
      const normalizedIndex = this.normalizeIndex(this.currentIndex);
      return this.images[normalizedIndex] ?? null;
    }

    if (this.imageUrl) {
      return { url: this.imageUrl, altText: this.altText, caption: this.caption };
    }

    return null;
  }

  get activeAltText(): string {
    const active = this.activeImage;
    if (active?.altText) {
      return active.altText;
    }
    return this.altText;
  }

  close(): void {
    this.isOpen = false;
    this.resetZoom();
    this.isOpenChange.emit(false);
  }

  nextImage(event?: Event): void {
    event?.stopPropagation();
    if (!this.hasMultipleImages) {
      return;
    }

    this.currentIndex = this.normalizeIndex(this.currentIndex + 1);
    this.resetZoom();
    this.currentIndexChange.emit(this.currentIndex);
  }

  prevImage(event?: Event): void {
    event?.stopPropagation();
    if (!this.hasMultipleImages) {
      return;
    }

    this.currentIndex = this.normalizeIndex(this.currentIndex - 1);
    this.resetZoom();
    this.currentIndexChange.emit(this.currentIndex);
  }

  zoomIn(): void {
    if (this.zoomLevel < 3) {
      this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 1) {
      this.zoomLevel = Math.max(1, this.zoomLevel - 0.25);
    }
  }

  private resetZoom(): void {
    this.zoomLevel = 1;
  }

  private normalizeIndex(index: number): number {
    const length = this.images.length;
    if (length === 0) {
      return 0;
    }

    const normalized = index % length;
    return normalized < 0 ? normalized + length : normalized;
  }
}
