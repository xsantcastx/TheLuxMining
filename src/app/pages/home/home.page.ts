import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ProductFirestoreService, FirestoreProduct } from '../../services/product-firestore.service';
import { GalleryService, GalleryImage } from '../../services/gallery.service';
import { CategoryService } from '../../services/category.service';
import { HomeHeroComponent } from '../../features/home/home-hero/home-hero.component';
import { HomeReviewsComponent } from '../../features/home/home-reviews/home-reviews.component';
import { LoadingComponentBase } from '../../core/classes/loading-component.base';
import { MetaService } from '../../services/meta.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, HomeHeroComponent, HomeReviewsComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePageComponent extends LoadingComponentBase implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private productService = inject(ProductFirestoreService);
  private galleryService = inject(GalleryService);
  private categoryService = inject(CategoryService);
  private metaService = inject(MetaService);
  
  // Dynamic product data from Firestore
  featuredProducts: FirestoreProduct[] = [];
  soloMinerProducts: FirestoreProduct[] = [];
  galleryImages: GalleryImage[] = [];
  hasProducts = false;
  hasSoloMiners = false;

  ngOnInit() {
    // Set page meta tags from settings
    this.metaService.setPageMeta({
      title: 'page_titles.home',
      description: 'home.hero.subtitle'
    });

    // Only load from service if in browser (not during SSR)
    if (isPlatformBrowser(this.platformId)) {
      this.loadLatestProducts();
      this.loadSoloMiners();
      this.loadGalleryPreview();
    } else {
      // During SSR, set loading to false to show empty state
      this.setLoading(false);
    }
  }

  private async loadLatestProducts() {
    await this.withLoading(async () => {
      const products = await new Promise<FirestoreProduct[]>((resolve, reject) => {
        this.productService.getProducts()
          .pipe(take(1))
          .subscribe({
            next: (products) => resolve(products),
            error: (error) => reject(error)
          });
      });
      
      // Filter available products and sort by creation date (newest first)
      const availableProducts = products
        .filter(p => p.available !== false)
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      
      // Take up to 8 latest products for featured section
      this.featuredProducts = availableProducts.slice(0, 8);
      this.hasProducts = this.featuredProducts.length > 0;
    });
  }

  private async loadSoloMiners() {
    try {
      // Get solo-miners category
      const categories = await new Promise<any[]>((resolve, reject) => {
        this.categoryService.getActiveCategories()
          .pipe(take(1))
          .subscribe({
            next: (categories) => resolve(categories),
            error: (error) => reject(error)
          });
      });

      const soloCategory = categories.find(cat => cat.slug === 'solo-miners');
      
      if (!soloCategory) {
        this.hasSoloMiners = false;
        return;
      }

      // Get all products
      const products = await new Promise<FirestoreProduct[]>((resolve, reject) => {
        this.productService.getProducts()
          .pipe(take(1))
          .subscribe({
            next: (products) => resolve(products),
            error: (error) => reject(error)
          });
      });

      // Filter solo miner products
      this.soloMinerProducts = products
        .filter(p => p.category === 'solo-miners' && p.available !== false)
        .slice(0, 3); // Take up to 3 for featured section

      this.hasSoloMiners = this.soloMinerProducts.length > 0;
    } catch (error) {
      console.error('Error loading solo miners:', error);
      this.hasSoloMiners = false;
    }
  }

  private async loadGalleryPreview() {
    // Get latest 6 gallery images (don't show loading for this secondary content)
    this.galleryService.getAllImages()
      .pipe(take(1))
      .subscribe({
        next: (images: GalleryImage[]) => {
          this.galleryImages = images.slice(0, 6);
        },
        error: (error: any) => {
          console.error('Error loading gallery:', error);
        }
      });
  }
}
