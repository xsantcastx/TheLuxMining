import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SetupGuide, SetupGuideStep } from '../../../models/setup-guide';
import { SetupGuideService } from '../../../services/setup-guide.service';
import { Media } from '../../../models/media';
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

  setupGuide: SetupGuide | null = null;
  isLoading = true;
  isSaving = false;

  // Media Selector State
  isMediaSelectorOpen = false;
  mediaSelectionTarget: 'video' | 'heroImage' | 'stepImage' = 'video';
  mediaSelectionStepId: string | null = null;

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

  isVideoUrl(): boolean {
    if (!this.setupGuide?.videoUrl) return false;
    return this.setupGuide.videoUrl.includes('http');
  }
}
