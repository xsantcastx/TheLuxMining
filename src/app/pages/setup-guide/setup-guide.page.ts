import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SetupGuide } from '../../models/setup-guide';
import { SetupGuideService } from '../../services/setup-guide.service';

@Component({
  selector: 'app-setup-guide',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './setup-guide.page.html',
  styleUrls: ['./setup-guide.page.scss']
})
export class SetupGuidePage implements OnInit {
  private setupGuideService = inject(SetupGuideService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  setupGuide: SetupGuide | null = null;
  isLoading = true;
  expandedFaqIndex: number | null = null;

  ngOnInit() {
    this.loadSetupGuide();
  }

  async loadSetupGuide() {
    try {
      this.isLoading = true;
      this.cdr.detectChanges(); // Force update to show spinner
      
      this.setupGuide = await this.setupGuideService.getPublishedGuide();
      
      this.isLoading = false;
      this.cdr.detectChanges(); // Force update to show content
    } catch (error) {
      console.error('Error loading setup guide:', error);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  isYouTubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    // Convert YouTube URLs to embed format
    let embedUrl = url;
    
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    }
    
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  toggleFaq(index: number) {
    this.expandedFaqIndex = this.expandedFaqIndex === index ? null : index;
  }
}
