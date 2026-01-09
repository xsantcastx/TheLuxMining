import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SetupGuide, SetupGuideStep } from '../../../models/setup-guide';
import heic2any from 'heic2any';
import { SetupGuideService } from '../../../services/setup-guide.service';
import { StorageService } from '../../../services/storage.service';
import { AuthService } from '../../../services/auth.service';
import { MediaService } from '../../../services/media.service';
import { Media, MediaCreateInput } from '../../../models/media';
import { MediaSelectorModalComponent } from '../../../shared/components/media-selector-modal/media-selector-modal.component';

@Component({
  selector: 'app-setup-guide-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaSelectorModalComponent],
  templateUrl: './setup-guide-admin.page.html',
  styleUrls: ['./setup-guide-admin.page.scss']
})
export class SetupGuideAdminPage implements OnInit {
  private setupGuideService = inject(SetupGuideService);
  private storageService = inject(StorageService);
  private authService = inject(AuthService);
  private mediaService = inject(MediaService);

  setupGuide: SetupGuide | null = null;
  isLoading = true;
  isSaving = false;

  // Media Selector State
  isMediaSelectorOpen = false;
  mediaSelectionTarget: 'video' | 'heroImage' | 'stepImage' = 'video';
  mediaSelectionStepId: string | null = null;

  // Video Upload State
  isUploadingVideo = false;
  videoUploadProgress = 0;
  videoUploadStatus = '';

  // Hero Image Upload State
  isUploadingHeroImage = false;
  heroImageUploadProgress = 0;
  heroImageUploadStatus = '';

  // Step Image Upload State
  uploadingStepImageId: string | null = null;
  stepImageUploadProgress = 0;
  stepImageUploadStatus = '';

  ngOnInit() {
    this.loadGuide();
  }

  async loadGuide() {
    try {
      this.isLoading = true;
      this.setupGuide = await this.setupGuideService.getGuide();
      
      // Initialize arrays if they don't exist or if setupGuide is null
      if (this.setupGuide) {
        if (!this.setupGuide.requirements) {
          this.setupGuide.requirements = [];
        }
        if (!this.setupGuide.steps) {
          this.setupGuide.steps = [];
        }
        if (!this.setupGuide.faqs) {
          this.setupGuide.faqs = [];
        }
      }
    } catch (error) {
      console.error('Error loading setup guide:', error);
      alert('Error loading setup guide. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async saveGuide() {
    if (!this.setupGuide) return;

    try {
      this.isSaving = true;
      await this.setupGuideService.saveGuide(this.setupGuide);
      alert('Setup guide saved successfully!');
    } catch (error) {
      console.error('Error saving setup guide:', error);
      alert('Error saving setup guide. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  // Requirements Management
  addRequirement() {
    if (!this.setupGuide!.requirements) {
      this.setupGuide!.requirements = [];
    }
    this.setupGuide!.requirements!.push('');
  }

  removeRequirement(index: number) {
    this.setupGuide!.requirements!.splice(index, 1);
  }

  // Steps Management
  addStep() {
    if (!this.setupGuide!.steps) {
      this.setupGuide!.steps = [];
    }

    const newOrder = this.setupGuide!.steps.length + 1;
    const newStep: SetupGuideStep = {
      id: `step-${Date.now()}`,
      title: '',
      description: '',
      order: newOrder
    };

    this.setupGuide!.steps.push(newStep);
  }

  removeStep(stepId: string) {
    const index = this.setupGuide!.steps.findIndex(s => s.id === stepId);
    if (index > -1) {
      this.setupGuide!.steps.splice(index, 1);
      // Reorder remaining steps
      this.setupGuide!.steps.forEach((step, idx) => {
        step.order = idx + 1;
      });
    }
  }

  moveStepUp(step: SetupGuideStep) {
    const index = this.setupGuide!.steps.findIndex(s => s.id === step.id);
    if (index > 0) {
      // Swap with previous step
      const temp = this.setupGuide!.steps[index];
      this.setupGuide!.steps[index] = this.setupGuide!.steps[index - 1];
      this.setupGuide!.steps[index - 1] = temp;
      
      // Update order numbers
      this.setupGuide!.steps.forEach((s, idx) => {
        s.order = idx + 1;
      });
    }
  }

  moveStepDown(step: SetupGuideStep) {
    const index = this.setupGuide!.steps.findIndex(s => s.id === step.id);
    if (index < this.setupGuide!.steps.length - 1) {
      // Swap with next step
      const temp = this.setupGuide!.steps[index];
      this.setupGuide!.steps[index] = this.setupGuide!.steps[index + 1];
      this.setupGuide!.steps[index + 1] = temp;
      
      // Update order numbers
      this.setupGuide!.steps.forEach((s, idx) => {
        s.order = idx + 1;
      });
    }
  }

  // FAQs Management
  addFaq() {
    if (!this.setupGuide!.faqs) {
      this.setupGuide!.faqs = [];
    }
    this.setupGuide!.faqs.push({
      question: '',
      answer: ''
    });
  }

  removeFaq(index: number) {
    this.setupGuide!.faqs!.splice(index, 1);
  }

  // Media Selector Methods
  openMediaSelectorForVideo() {
    this.mediaSelectionTarget = 'video';
    this.isMediaSelectorOpen = true;
  }

  openMediaSelectorForHeroImage() {
    this.mediaSelectionTarget = 'heroImage';
    this.isMediaSelectorOpen = true;
  }

  openMediaSelectorForStepImage(stepId: string) {
    this.mediaSelectionTarget = 'stepImage';
    this.mediaSelectionStepId = stepId;
    this.isMediaSelectorOpen = true;
  }

  onMediaSelected(media: Media | Media[]) {
    if (!this.setupGuide) return;

    const selectedMedia = Array.isArray(media) ? media[0] : media;
    
    if (this.mediaSelectionTarget === 'video') {
      this.setupGuide.videoUrl = selectedMedia.url;
    } else if (this.mediaSelectionTarget === 'heroImage') {
      this.setupGuide.heroImageUrl = selectedMedia.url;
    } else if (this.mediaSelectionTarget === 'stepImage' && this.mediaSelectionStepId) {
      const step = this.setupGuide.steps.find(s => s.id === this.mediaSelectionStepId);
      if (step) {
        step.imageUrl = selectedMedia.url;
      }
    }

    this.closeMediaSelector();
  }

  closeMediaSelector() {
    this.isMediaSelectorOpen = false;
    this.mediaSelectionStepId = null;
  }

  clearVideo() {
    if (this.setupGuide) {
      this.setupGuide.videoUrl = '';
    }
  }

  clearHeroImage() {
    if (this.setupGuide) {
      this.setupGuide.heroImageUrl = '';
    }
  }

  clearStepImage(stepId: string) {
    if (!this.setupGuide) return;
    const step = this.setupGuide.steps.find(s => s.id === stepId);
    if (step) {
      step.imageUrl = '';
    }
  }

  private async convertHeicIfNeeded(file: File): Promise<File> {
    const fileName = file.name.toLowerCase();
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') ||
      file.type === 'image/heic' || file.type === 'image/heif';
    if (!isHeic) {
      return file;
    }

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9
    });

    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    const newFileName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: file.lastModified
    });
  }

  isVideoUrl(): boolean {
    if (!this.setupGuide?.videoUrl) return false;
    return this.setupGuide.videoUrl.includes('http');
  }

  async onVideoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Validate video file
    this.videoUploadStatus = 'Validating video...';
    const validation = await this.storageService.validateVideoFile(file, 200);
    if (!validation.valid) {
      alert(`Video validation failed: ${validation.error}`);
      input.value = ''; // Reset input
      return;
    }

    try {
      this.isUploadingVideo = true;
      this.videoUploadProgress = 0;
      this.videoUploadStatus = 'Uploading video...';

      // Upload video to storage
      const timestamp = Date.now();
      const pathWithoutExt = `setup-guide/video-${timestamp}`;
      
      this.storageService.uploadOptimizedVideo(file, pathWithoutExt).subscribe({
        next: async (progress) => {
          this.videoUploadProgress = progress.progress || 0;
          
          if (progress.optimizing) {
            this.videoUploadStatus = 'Optimizing video...';
          } else if (progress.progress && progress.progress < 100) {
            this.videoUploadStatus = `Uploading: ${progress.progress}%`;
          }

          if (progress.downloadURL) {
            this.videoUploadStatus = 'Saving to media library...';
            
            // Create media document in Firestore
            const currentUser = this.authService.getCurrentUser();
            const mediaInput: MediaCreateInput = {
              url: progress.downloadURL,
              thumbnailUrl: progress.thumbnailURL,
              filename: file.name,
              storagePath: pathWithoutExt,
              width: progress.dimensions?.width || 1920,
              height: progress.dimensions?.height || 1080,
              size: file.size,
              mimeType: file.type,
              mediaType: 'video',
              uploadedBy: currentUser?.uid || 'system',
              tags: ['setup-guide', 'video']
            };

            await this.mediaService.createMedia(mediaInput);

            // Set video URL in setup guide
            if (this.setupGuide) {
              this.setupGuide.videoUrl = progress.downloadURL;
              if (progress.thumbnailURL) {
                this.setupGuide.videoThumbnailUrl = progress.thumbnailURL;
              }
            }

            this.videoUploadStatus = 'Upload complete!';
            setTimeout(() => {
              this.isUploadingVideo = false;
              this.videoUploadProgress = 0;
              this.videoUploadStatus = '';
            }, 1500);
          }
        },
        error: (error) => {
          console.error('Video upload error:', error);
          alert(`Video upload failed: ${error.message || 'Unknown error'}`);
          this.isUploadingVideo = false;
          this.videoUploadProgress = 0;
          this.videoUploadStatus = '';
          input.value = ''; // Reset input
        }
      });
    } catch (error) {
      console.error('Video upload error:', error);
      alert('Failed to upload video. Please try again.');
      this.isUploadingVideo = false;
      this.videoUploadProgress = 0;
      this.videoUploadStatus = '';
      input.value = ''; // Reset input
    }
  }

  async onHeroImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    let file = input.files[0];

    try {
      file = await this.convertHeicIfNeeded(file);
    } catch (error) {
      console.error('HEIC conversion error:', error);
      alert('Failed to convert HEIC image. Please convert to JPG manually or use a different image.');
      input.value = '';
      return;
    }

    // Validate image file
    this.heroImageUploadStatus = 'Validating image...';
    const validation = this.storageService.validateImageFile(file, 5);
    if (!validation.valid) {
      alert(`Image validation failed: ${validation.error}`);
      input.value = ''; // Reset input
      return;
    }

    try {
      this.isUploadingHeroImage = true;
      this.heroImageUploadProgress = 0;
      this.heroImageUploadStatus = 'Uploading image...';

      // Upload image to storage
      const timestamp = Date.now();
      const pathWithoutExt = `setup-guide/hero-${timestamp}`;
      
      this.storageService.uploadOptimizedImage(file, pathWithoutExt).subscribe({
        next: async (progress) => {
          this.heroImageUploadProgress = progress.progress || 0;
          
          if (progress.optimizing) {
            this.heroImageUploadStatus = 'Optimizing image...';
          } else if (progress.progress && progress.progress < 100) {
            this.heroImageUploadStatus = `Uploading: ${progress.progress}%`;
          }

          if (progress.downloadURL) {
            this.heroImageUploadStatus = 'Saving to media library...';
            
            // Create media document in Firestore
            const currentUser = this.authService.getCurrentUser();
            const mediaInput: MediaCreateInput = {
              url: progress.downloadURL,
              thumbnailUrl: progress.thumbnailURL,
              filename: file.name,
              storagePath: pathWithoutExt,
              width: progress.dimensions?.width || 1920,
              height: progress.dimensions?.height || 1080,
              size: file.size,
              mimeType: file.type,
              mediaType: 'image',
              uploadedBy: currentUser?.uid || 'system',
              tags: ['setup-guide', 'hero']
            };

            await this.mediaService.createMedia(mediaInput);

            // Set hero image URL in setup guide
            if (this.setupGuide) {
              this.setupGuide.heroImageUrl = progress.downloadURL;
            }

            this.heroImageUploadStatus = 'Upload complete!';
            setTimeout(() => {
              this.isUploadingHeroImage = false;
              this.heroImageUploadProgress = 0;
              this.heroImageUploadStatus = '';
            }, 1500);
          }
        },
        error: (error) => {
          console.error('Hero image upload error:', error);
          alert(`Image upload failed: ${error.message || 'Unknown error'}`);
          this.isUploadingHeroImage = false;
          this.heroImageUploadProgress = 0;
          this.heroImageUploadStatus = '';
          input.value = ''; // Reset input
        }
      });
    } catch (error) {
      console.error('Hero image upload error:', error);
      alert('Failed to upload image. Please try again.');
      this.isUploadingHeroImage = false;
      this.heroImageUploadProgress = 0;
      this.heroImageUploadStatus = '';
      input.value = ''; // Reset input
    }
  }

  async onStepImageSelected(event: Event, stepId: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    let file = input.files[0];

    try {
      file = await this.convertHeicIfNeeded(file);
    } catch (error) {
      console.error('HEIC conversion error:', error);
      alert('Failed to convert HEIC image. Please convert to JPG manually or use a different image.');
      input.value = '';
      return;
    }

    // Validate image file
    this.stepImageUploadStatus = 'Validating image...';
    const validation = this.storageService.validateImageFile(file, 5);
    if (!validation.valid) {
      alert(`Image validation failed: ${validation.error}`);
      input.value = ''; // Reset input
      return;
    }

    try {
      this.uploadingStepImageId = stepId;
      this.stepImageUploadProgress = 0;
      this.stepImageUploadStatus = 'Uploading image...';

      // Upload image to storage
      const timestamp = Date.now();
      const pathWithoutExt = `setup-guide/step-${stepId}-${timestamp}`;
      
      this.storageService.uploadOptimizedImage(file, pathWithoutExt).subscribe({
        next: async (progress) => {
          this.stepImageUploadProgress = progress.progress || 0;
          
          if (progress.optimizing) {
            this.stepImageUploadStatus = 'Optimizing image...';
          } else if (progress.progress && progress.progress < 100) {
            this.stepImageUploadStatus = `Uploading: ${progress.progress}%`;
          }

          if (progress.downloadURL) {
            this.stepImageUploadStatus = 'Saving to media library...';
            
            // Create media document in Firestore
            const currentUser = this.authService.getCurrentUser();
            const mediaInput: MediaCreateInput = {
              url: progress.downloadURL,
              thumbnailUrl: progress.thumbnailURL,
              filename: file.name,
              storagePath: pathWithoutExt,
              width: progress.dimensions?.width || 1920,
              height: progress.dimensions?.height || 1080,
              size: file.size,
              mimeType: file.type,
              mediaType: 'image',
              uploadedBy: currentUser?.uid || 'system',
              tags: ['setup-guide', 'step']
            };

            await this.mediaService.createMedia(mediaInput);

            // Set step image URL in setup guide
            if (this.setupGuide) {
              const step = this.setupGuide.steps.find(s => s.id === stepId);
              if (step) {
                step.imageUrl = progress.downloadURL;
              }
            }

            this.stepImageUploadStatus = 'Upload complete!';
            setTimeout(() => {
              this.uploadingStepImageId = null;
              this.stepImageUploadProgress = 0;
              this.stepImageUploadStatus = '';
            }, 1500);
          }
        },
        error: (error) => {
          console.error('Step image upload error:', error);
          alert(`Image upload failed: ${error.message || 'Unknown error'}`);
          this.uploadingStepImageId = null;
          this.stepImageUploadProgress = 0;
          this.stepImageUploadStatus = '';
          input.value = ''; // Reset input
        }
      });
    } catch (error) {
      console.error('Step image upload error:', error);
      alert('Failed to upload image. Please try again.');
      this.uploadingStepImageId = null;
      this.stepImageUploadProgress = 0;
      this.stepImageUploadStatus = '';
      input.value = ''; // Reset input
    }
  }
}
