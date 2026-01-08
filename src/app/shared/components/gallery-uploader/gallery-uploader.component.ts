import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaService } from '../../../services/media.service';
import { StorageService } from '../../../services/storage.service';
import { AuthService } from '../../../services/auth.service';
import { Media, MediaCreateInput, MEDIA_VALIDATION, MediaTag, PRODUCT_TAGS } from '../../../models/media';

interface GalleryImagePreview {
  file: File;
  preview: string;
  dimensions?: { width: number; height: number };
  selectedTags: string[];
  uploadProgress: number;
  uploading: boolean;
  error?: string;
  mediaId?: string;
}

@Component({
  selector: 'app-gallery-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gallery-uploader.component.html',
  styleUrl: './gallery-uploader.component.scss'
})
export class GalleryUploaderComponent implements OnInit {
  @Input() existingMediaIds: string[] = [];
  @Input() productSlug: string = '';
  @Input() productCategorySlug: string = '';
  @Input() availableTags: string[] = []; // Custom tags from parent component
  @Output() mediaIdsChange = new EventEmitter<string[]>();
  @Output() uploadingChange = new EventEmitter<boolean>(); // Notify parent when upload status changes

  previews: GalleryImagePreview[] = [];
  existingMedia: Media[] = [];
  isDragging = false;
  errorMessage = '';

  readonly defaultTags = PRODUCT_TAGS; // Fallback to default tags
  readonly minWidth = MEDIA_VALIDATION.MIN_WIDTH;
  readonly minHeight = MEDIA_VALIDATION.MIN_HEIGHT;
  readonly maxSize = MEDIA_VALIDATION.MAX_SIZE;

  constructor(
    private mediaService: MediaService,
    private storageService: StorageService,
    private authService: AuthService
  ) {}

  // Computed property to get tags (custom or default)
  get tags(): string[] {
    return this.availableTags.length > 0 ? this.availableTags : this.defaultTags;
  }

  async ngOnInit() {
    if (this.existingMediaIds.length > 0) {
      await this.loadExistingMedia();
    }
  }

  private async loadExistingMedia() {
    try {
      this.existingMedia = await this.mediaService.getMediaByIds(this.existingMediaIds);
      console.log('✅ Loaded existing media:', this.existingMedia.length);
    } catch (error) {
      console.error('❌ Error loading existing media:', error);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  private async handleFiles(files: File[]) {
    this.errorMessage = '';

    for (const file of files) {
      // Validate file type
      const validation = this.storageService.validateImageFile(file);
      if (!validation.valid) {
        this.errorMessage = validation.error || 'Invalid file';
        continue;
      }

      // Validate file size
      if (file.size > this.maxSize) {
        this.errorMessage = `File ${file.name} is too large. Max ${this.maxSize / 1024 / 1024}MB`;
        continue;
      }

      // Get dimensions
      let dimensions: { width: number; height: number } | undefined;
      try {
        dimensions = await this.mediaService.getImageDimensions(file);
        
        // Validate dimensions
        if (dimensions.width < this.minWidth || dimensions.height < this.minHeight) {
          this.errorMessage = `Image ${file.name} is too small: ${dimensions.width}x${dimensions.height}px. Minimum: ${this.minWidth}x${this.minHeight}px`;
          continue;
        }
      } catch (error) {
        console.error('Error getting dimensions:', error);
        this.errorMessage = `Failed to load image ${file.name}`;
        continue;
      }

      // Create preview
      const preview: GalleryImagePreview = {
        file,
        preview: URL.createObjectURL(file),
        dimensions,
        selectedTags: ['detail'], // Default tag
        uploadProgress: 0,
        uploading: false,
      };

      this.previews.push(preview);
    }
  }

  removePreview(index: number) {
    if (index < 0 || index >= this.previews.length) {
      return;
    }

    const preview = this.previews[index];
    URL.revokeObjectURL(preview.preview);
    this.previews.splice(index, 1);

    this.emitMediaIds();
  }

  async removeExistingMedia(mediaId: string) {
    if (!confirm('Are you sure you want to remove this image?')) {
      return;
    }

    try {
      // Remove from local array
      this.existingMedia = this.existingMedia.filter(m => m.id !== mediaId);
      
      // Update parent component
      this.emitMediaIds();

      console.log('✅ Media removed from gallery:', mediaId);
    } catch (error) {
      console.error('❌ Error removing media:', error);
      this.errorMessage = 'Failed to remove image';
    }
  }

  toggleTag(preview: GalleryImagePreview, tag: string) {
    const index = preview.selectedTags.indexOf(tag);
    if (index > -1) {
      preview.selectedTags.splice(index, 1);
    } else {
      preview.selectedTags.push(tag);
    }
  }

  isTagSelected(preview: GalleryImagePreview, tag: string): boolean {
    return preview.selectedTags.includes(tag);
  }

  async uploadAll() {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'User not authenticated';
      return;
    }

    this.uploadingChange.emit(true); // Notify parent that upload started

    const uploadPromises = this.previews
      .filter(p => !p.uploading && !p.mediaId)
      .map(preview => this.uploadSingle(preview, user.uid));

    await Promise.all(uploadPromises);
    
    // Emit all media IDs (existing + new)
    this.emitMediaIds();

    this.uploadingChange.emit(false); // Notify parent that upload finished
  }

  private async uploadSingle(preview: GalleryImagePreview, userId: string): Promise<void> {
    preview.uploading = true;
    preview.error = undefined;

    try {
      // Create unique filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const filename = `${timestamp}_${preview.file.name}`;
      
      // Upload to Storage (will go to productos/{slug}/gallery/ path)
      const downloadURL = await new Promise<string>((resolve, reject) => {
        this.storageService.uploadProductImage(
          preview.file,
          `${this.productSlug}/gallery`
        ).subscribe({
          next: (progress) => {
            preview.uploadProgress = progress.progress;
            if (progress.downloadURL) {
              resolve(progress.downloadURL);
            }
          },
          error: reject
        });
      });

      // Extract storage path from download URL
      const storagePath = `productos/${this.productSlug}/gallery/${preview.file.name}`;

      // Create Media document
      const mediaInput: MediaCreateInput = {
        url: downloadURL,
        filename: preview.file.name,
        storagePath,
        width: preview.dimensions?.width || 0,
        height: preview.dimensions?.height || 0,
        size: preview.file.size,
        mimeType: preview.file.type,
        uploadedBy: userId,
        tags: preview.selectedTags,
        relatedEntityType: 'product',
        relatedEntityIds: [],
      };

      const mediaId = await this.mediaService.createMedia(mediaInput);
      preview.mediaId = mediaId;
      preview.uploading = false;

      console.log('✅ Gallery image uploaded:', mediaId);

    } catch (error) {
      console.error('❌ Error uploading gallery image:', error);
      preview.error = 'Upload failed';
      preview.uploading = false;
    }
  }

  private emitMediaIds() {
    // Combine existing media IDs + newly uploaded media IDs
    const existingIds = this.existingMedia.map(m => m.id!);
    const newIds = this.previews
      .filter(p => p.mediaId)
      .map(p => p.mediaId!);

    const allIds = [...existingIds, ...newIds];
    this.mediaIdsChange.emit(allIds);
  }

  get hasUnsavedImages(): boolean {
    return this.previews.some(p => !p.mediaId && !p.uploading);
  }

  get unsavedCount(): number {
    return this.previews.filter(p => !p.mediaId && !p.uploading).length;
  }

  get isUploading(): boolean {
    return this.previews.some(p => p.uploading);
  }

  get uploadedCount(): number {
    return this.previews.filter(p => p.mediaId).length;
  }

  get totalImages(): number {
    return this.existingMedia.length + this.previews.length;
  }
}
