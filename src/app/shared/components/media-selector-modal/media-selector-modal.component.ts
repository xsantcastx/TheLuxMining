import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaService } from '../../../services/media.service';
import { Media, MediaTag, MEDIA_VALIDATION } from '../../../models/media';

@Component({
  selector: 'app-media-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './media-selector-modal.component.html',
  styleUrl: './media-selector-modal.component.scss'
})
export class MediaSelectorModalComponent implements OnInit {
  private mediaService = inject(MediaService);

  @Input() isOpen = false;
  @Input() selectionMode: 'single' | 'multiple' = 'single';
  @Input() mediaType: 'image' | 'video' | 'all' = 'all';
  @Input() title = 'Select Media';
  @Output() mediaSelected = new EventEmitter<Media | Media[]>();
  @Output() close = new EventEmitter<void>();

  allMedia: Media[] = [];
  filteredMedia: Media[] = [];
  selectedMedia: Media[] = [];
  searchTerm = '';
  selectedTag: MediaTag | 'all' = 'all';
  isLoading = false;

  readonly galleryTags = MEDIA_VALIDATION.GALLERY_TAGS;
  readonly productTags = MEDIA_VALIDATION.PRODUCT_TAGS;

  async ngOnInit() {
    await this.loadMedia();
  }

  private async loadMedia() {
    this.isLoading = true;
    try {
      this.mediaService.getAllMedia().subscribe({
        next: (media) => {
          // Filter out HEIC files (broken images) - they shouldn't exist anymore but just in case
          this.allMedia = media.filter(m => 
            !m.filename.toLowerCase().endsWith('.heic') && 
            !m.filename.toLowerCase().endsWith('.heif')
          );
          this.applyFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading media:', error);
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error loading media:', error);
      this.isLoading = false;
    }
  }

  private applyFilters() {
    let filtered = [...this.allMedia];

    // Filter by media type
    if (this.mediaType !== 'all') {
      filtered = filtered.filter(m => {
        if (this.mediaType === 'image') {
          return m.mimeType.startsWith('image/');
        } else if (this.mediaType === 'video') {
          return m.mimeType.startsWith('video/');
        }
        return true;
      });
    }

    // Filter by tag
    if (this.selectedTag !== 'all') {
      filtered = filtered.filter(m => m.tags.includes(this.selectedTag as MediaTag));
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.altText?.toLowerCase().includes(term) ||
        m.filename.toLowerCase().includes(term) ||
        m.caption?.toLowerCase().includes(term)
      );
    }

    this.filteredMedia = filtered;
  }

  onSearchChange() {
    this.applyFilters();
  }

  onTagChange(tag: MediaTag | 'all') {
    this.selectedTag = tag;
    this.applyFilters();
  }

  toggleMediaSelection(media: Media) {
    if (!media.id) return;

    if (this.selectionMode === 'single') {
      this.selectedMedia = [media];
    } else {
      const index = this.selectedMedia.findIndex(m => m.id === media.id);
      if (index > -1) {
        this.selectedMedia.splice(index, 1);
      } else {
        this.selectedMedia.push(media);
      }
    }
  }

  isSelected(media: Media): boolean {
    return this.selectedMedia.some(m => m.id === media.id);
  }

  confirmSelection() {
    if (this.selectedMedia.length === 0) {
      return;
    }

    if (this.selectionMode === 'single') {
      this.mediaSelected.emit(this.selectedMedia[0]);
    } else {
      this.mediaSelected.emit(this.selectedMedia);
    }

    this.closeModal();
  }

  closeModal() {
    this.selectedMedia = [];
    this.searchTerm = '';
    this.selectedTag = 'all';
    this.close.emit();
  }

  getMediaType(media: Media): 'image' | 'video' {
    return media.mimeType.startsWith('image/') ? 'image' : 'video';
  }

  getTagCount(tag: MediaTag | 'all'): number {
    if (tag === 'all') {
      return this.allMedia.length;
    }
    return this.allMedia.filter(m => m.tags.includes(tag)).length;
  }
}
