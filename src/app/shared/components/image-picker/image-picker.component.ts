import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';

@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3">
      <!-- Current Image Preview -->
      @if (imageUrl) {
        <div class="relative inline-block">
          <img 
            [src]="imageUrl" 
            [alt]="label"
            class="w-full max-w-sm h-48 object-cover rounded-lg border-2 border-white/20">
          <button
            type="button"
            (click)="removeImage()"
            [disabled]="disabled"
            class="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      }

      <!-- Upload Button -->
      <div class="flex gap-2">
        <button
          type="button"
          (click)="fileInput.click()"
          [disabled]="disabled || isUploading"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2">
          @if (isUploading) {
            <div class="app-spinner" style="--spinner-size: 20px; --spinner-logo-scale: 90%;" aria-hidden="true">
              <img src="/Logo Clear.png" alt="" width="24" height="24">
            </div>
            <span>Uploading...</span>
          } @else {
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>{{ imageUrl ? 'Change Image' : 'Upload Image' }}</span>
          }
        </button>

        @if (imageUrl && !disabled) {
          <input
            type="text"
            [value]="imageUrl"
            readonly
            class="flex-1 px-3 py-2 bg-gray-700/50 border border-white/20 rounded-lg text-white/90 text-sm"
            placeholder="Image URL will appear here">
        }
      </div>

      <!-- Hidden File Input -->
      <input
        #fileInput
        type="file"
        accept="image/*,.heic,.heif"
        (change)="onFileSelected($event)"
        class="hidden">

      <!-- Error Message -->
      @if (errorMessage) {
        <p class="text-sm text-red-400">{{ errorMessage }}</p>
      }

      <!-- Help Text -->
      @if (helpText) {
        <p class="text-xs text-white/60">{{ helpText }}</p>
      }
    </div>
  `,
  styles: []
})
export class ImagePickerComponent {
  @Input() imageUrl: string = '';
  @Input() label: string = '';
  @Input() storagePath: string = 'settings'; // Default storage folder
  @Input() disabled: boolean = false;
  @Input() helpText: string = 'Recommended: 1200x630px for social media';
  @Output() imageUrlChange = new EventEmitter<string>();

  private storage = inject(Storage);
  
  isUploading = false;
  errorMessage = '';

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select an image file';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image size must be less than 5MB';
      return;
    }

    this.errorMessage = '';
    this.isUploading = true;

    try {
      // Create unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedName}`;
      const filePath = `${this.storagePath}/${fileName}`;

      // Upload to Firebase Storage
      const storageRef = ref(this.storage, filePath);
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Delete old image if exists
      if (this.imageUrl && this.imageUrl.includes('firebasestorage')) {
        await this.deleteOldImage(this.imageUrl);
      }

      // Emit new URL
      this.imageUrl = downloadURL;
      this.imageUrlChange.emit(downloadURL);

      console.log('[ImagePicker] Image uploaded successfully:', downloadURL);
    } catch (error) {
      console.error('[ImagePicker] Upload error:', error);
      this.errorMessage = 'Failed to upload image. Please try again.';
    } finally {
      this.isUploading = false;
      // Reset input
      input.value = '';
    }
  }

  async removeImage(): Promise<void> {
    if (!this.imageUrl) return;

    if (!confirm('Are you sure you want to remove this image?')) {
      return;
    }

    try {
      // Delete from storage if it's a Firebase URL
      if (this.imageUrl.includes('firebasestorage')) {
        await this.deleteOldImage(this.imageUrl);
      }

      // Clear URL
      this.imageUrl = '';
      this.imageUrlChange.emit('');

      console.log('[ImagePicker] Image removed successfully');
    } catch (error) {
      console.error('[ImagePicker] Error removing image:', error);
      this.errorMessage = 'Failed to remove image';
    }
  }

  private async deleteOldImage(url: string): Promise<void> {
    try {
      // Extract path from Firebase Storage URL
      const decodedUrl = decodeURIComponent(url);
      const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
      
      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1];
        const storageRef = ref(this.storage, filePath);
        await deleteObject(storageRef);
        console.log('[ImagePicker] Old image deleted:', filePath);
      }
    } catch (error) {
      // Ignore errors if file doesn't exist
      console.warn('[ImagePicker] Could not delete old image:', error);
    }
  }
}
