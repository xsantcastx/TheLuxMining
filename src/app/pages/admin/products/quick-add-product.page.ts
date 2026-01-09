import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom, lastValueFrom, filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ProductsService } from '../../../services/products.service';
import { CategoryService } from '../../../services/category.service';
import { ModelService } from '../../../services/model.service';
import { TagService } from '../../../services/tag.service';
import { StorageService, UploadProgress } from '../../../services/storage.service';
import { MediaService } from '../../../services/media.service';
import { BenefitTemplateService } from '../../../services/benefit-template.service';
import { Product, ProductBenefit } from '../../../models/product';
import { Category, Model, Tag } from '../../../models/catalog';
import { BenefitTemplate } from '../../../models/benefit-template';
import { MediaCreateInput, MEDIA_VALIDATION } from '../../../models/media';
import heic2any from 'heic2any';
import { LoadingComponentBase } from '../../../core/classes/loading-component.base';

@Component({
  selector: 'app-quick-add-product',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule, TranslateModule],
  templateUrl: './quick-add-product.page.html',
  styleUrl: './quick-add-product.page.scss'
})
export class QuickAddProductComponent extends LoadingComponentBase implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private productsService = inject(ProductsService);
  private categoryService = inject(CategoryService);
  private modelService = inject(ModelService);
  private tagService = inject(TagService);
  private storageService = inject(StorageService);
  private mediaService = inject(MediaService);
  private benefitTemplateService = inject(BenefitTemplateService);

  categories: Category[] = [];
  models: Model[] = [];
  tags: Tag[] = [];
  filteredModels: Model[] = [];
  benefitTemplates: BenefitTemplate[] = [];
  currentBenefits: ProductBenefit[] = [];

  productForm: FormGroup;
  
  isSaving = false;
  isUploading = false;
  uploadProgress = 0;
  isEditMode = false;
  editingProductId: string | null = null;

  // Image upload
  selectedCoverFile: File | null = null;
  coverPreview: string | null = null;
  galleryFiles: File[] = [];
  galleryPreviews: string[] = [];
  
  // Store existing IDs when editing
  existingCoverImageId: string = '';
  existingGalleryImageIds: string[] = [];
  
  // Technical Specifications
  newSpecKey = '';
  newSpecValue = '';
  currentSpecs: Record<string, any> = {};
  
  // Dynamic creation
  showNewCategoryInput = false;
  showNewModelInput = false;
  newCategoryName = '';
  newModelName = '';
  
  // SEO Preview
  seoPreviewTitle = '';
  seoPreviewDescription = '';
  seoPreviewUrl = '';

  successMessage = '';

  constructor() {
    super();
    this.productForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      status: ['draft', Validators.required],
      description: [''],
      categoryId: ['', Validators.required],
      modelId: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      sku: [''],
      weight: [0, Validators.min(0)],
      collections: [''],
      tags: [''],
      vendor: ['TheLuxMining'],
      // SEO fields
      metaTitle: [''],
      metaDescription: [''],
      slug: ['']
    });
  }

  async ngOnInit() {
    await this.checkAuth();
    
    // Check if we're in edit mode
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.editingProductId = params['id'];
      }
    });
    
    await this.loadData();
    
    // Load benefit templates
    this.benefitTemplateService.getActiveTemplates().subscribe({
      next: (templates) => {
        this.benefitTemplates = templates;
      },
      error: (err) => console.error('Error loading benefit templates:', err)
    });
    
    // Load product data if editing
    if (this.isEditMode && this.editingProductId) {
      await this.loadProductForEdit(this.editingProductId);
    }
    
    this.setupFormListeners();
  }

  private async checkAuth() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/admin/login']);
      return;
    }
  }

  private async loadProductForEdit(productId: string) {
    try {
      const product = await firstValueFrom(this.productsService.getProduct(productId));
      if (!product) {
        this.errorMessage = 'Product not found';
        this.router.navigate(['/admin/products']);
        return;
      }

      // Populate form with product data
      this.productForm.patchValue({
        title: product.name || '',
        status: product.status || 'draft',
        description: product.description || '',
        categoryId: product.categoryId || '',
        modelId: product.modelId || '',
        price: product.price || 0,
        stock: product.stock || 0,
        sku: product.sku || '',
        tags: product.tags?.join(', ') || '',
        metaTitle: product.seo?.title || '',
        metaDescription: product.seo?.metaDescription || '',
        slug: product.slug || ''
      });

      // Load benefits
      if (product.benefits && product.benefits.length > 0) {
        this.currentBenefits = [...product.benefits];
      }

      // Load specs
      if (product.specs) {
        this.currentSpecs = { ...product.specs };
      }

      // Store existing image IDs
      if (product.coverImage) {
        this.existingCoverImageId = product.coverImage;
        
        if (product.coverImage.startsWith('http')) {
          this.coverPreview = product.coverImage;
        } else {
          // It's a Media ID - load the URL
          try {
            const media = await this.mediaService.getMediaById(product.coverImage);
            this.coverPreview = media?.url || '';
          } catch (error) {
            console.error('Error loading cover image:', error);
          }
        }
      } else if (product.imageUrl) {
        this.coverPreview = product.imageUrl;
      }

      // Store and load gallery image IDs
      if (product.galleryImageIds && product.galleryImageIds.length > 0) {
        this.existingGalleryImageIds = [...product.galleryImageIds];
        
        // Load gallery previews
        try {
          for (const mediaId of product.galleryImageIds) {
            const media = await this.mediaService.getMediaById(mediaId);
            if (media?.url) {
              this.galleryPreviews.push(media.url);
            }
          }
        } catch (error) {
          console.error('Error loading gallery images:', error);
        }
      }

      // Update SEO preview
      this.updateSEOPreview();
      
      // Force change detection to update UI
      this.forceUpdate();
      
    } catch (error) {
      console.error('Error loading product:', error);
      this.setError('Failed to load product');
    }
  }

  private async loadData() {
    await this.withLoading(async () => {
      // Load categories, models, and tags in parallel
      const [categories, models, tags] = await Promise.all([
        firstValueFrom(this.categoryService.getAllCategories()),
        firstValueFrom(this.modelService.getAllModels()),
        firstValueFrom(this.tagService.getTags())
      ]);

      this.categories = categories;
      this.models = models;
      this.tags = tags;
      this.filteredModels = models;
    }, true); // Show errors automatically
  }

  private setupFormListeners() {
    // Auto-generate slug from title (always automatic, no manual editing)
    this.productForm.get('title')?.valueChanges.subscribe(title => {
      if (title) {
        const slug = this.generateSlug(title);
        console.log('Generating slug from title:', title, '→', slug);
        this.productForm.patchValue({ slug }, { emitEvent: false });
      }
      this.updateSEOPreview();
    });

    // Filter models when category changes
    this.productForm.get('categoryId')?.valueChanges.subscribe(categoryId => {
      if (categoryId) {
        this.filteredModels = this.models.filter(m => m.categoryId === categoryId);
        // Reset model if it doesn't match the new category
        const currentModelId = this.productForm.get('modelId')?.value;
        if (currentModelId && !this.filteredModels.find(m => m.id === currentModelId)) {
          this.productForm.patchValue({ modelId: '' });
        }
      } else {
        this.filteredModels = this.models;
      }
    });

    // Update SKU when model changes
    this.productForm.get('modelId')?.valueChanges.subscribe(modelId => {
      if (modelId && !this.productForm.get('sku')?.value) {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          const sku = this.generateSKU(model.name);
          this.productForm.patchValue({ sku }, { emitEvent: false });
        }
      }
    });

    // Update SEO preview on description change
    this.productForm.get('description')?.valueChanges.subscribe(() => {
      this.updateSEOPreview();
    });

    this.productForm.get('metaTitle')?.valueChanges.subscribe(() => {
      this.updateSEOPreview();
    });

    this.productForm.get('metaDescription')?.valueChanges.subscribe(() => {
      this.updateSEOPreview();
    });
  }

  private generateSlug(title: string): string {
    if (!title) return '';
    
    const slug = title
      .toString()                          // Ensure it's a string
      .toLowerCase()                       // Convert to lowercase
      .trim()                              // Remove leading/trailing spaces
      .replace(/[^a-z0-9\s-]/g, '')       // Remove special characters
      .replace(/\s+/g, '-')               // Replace spaces with hyphens
      .replace(/-+/g, '-')                // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '');           // Remove leading/trailing hyphens
    
    console.log('generateSlug:', { input: title, output: slug });
    return slug;
  }

  private generateSKU(modelName: string): string {
    const prefix = modelName.substring(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${prefix}-${random}`;
  }

  private updateSEOPreview() {
    const title = this.productForm.get('metaTitle')?.value || this.productForm.get('title')?.value || '';
    const description = this.productForm.get('metaDescription')?.value || 
                       this.productForm.get('description')?.value?.substring(0, 160) || '';
    const slug = this.productForm.get('slug')?.value || '';
    
    this.seoPreviewTitle = title || 'Product Title';
    this.seoPreviewDescription = description || 'Product description will appear here...';
    this.seoPreviewUrl = `https://theluxmining.com/productos/${slug || 'product-url'}`;
  }

  async onCoverImageSelected(event: any) {
    let file = event.target.files[0];
    if (file) {
      try {
        file = await this.convertHeicIfNeeded(file);
      } catch (error) {
        console.error('HEIC conversion error:', error);
        this.errorMessage = 'Failed to convert HEIC image. Please convert to JPG manually.';
        return;
      }

      const validation = this.storageService.validateImageFile(file);
      if (!validation.valid) {
        this.errorMessage = validation.error || 'Invalid image file';
        return;
      }

      if (file.size > MEDIA_VALIDATION.MAX_SIZE) {
        this.errorMessage = 'admin.errors.file_too_large';
        return;
      }

      this.selectedCoverFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.coverPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async onGalleryImagesSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    
    for (const file of files) {
      let processedFile = file;
      try {
        processedFile = await this.convertHeicIfNeeded(file);
      } catch (error) {
        console.error('HEIC conversion error:', error);
        this.errorMessage = 'Failed to convert HEIC image. Please convert to JPG manually.';
        continue;
      }

      const validation = this.storageService.validateImageFile(processedFile);
      if (!validation.valid) {
        this.errorMessage = validation.error || 'Invalid image file';
        continue;
      }

      if (processedFile.size > MEDIA_VALIDATION.MAX_SIZE) {
        this.errorMessage = 'admin.errors.file_too_large';
        continue;
      }

      this.galleryFiles.push(processedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.galleryPreviews.push(e.target.result);
      };
      reader.readAsDataURL(processedFile);
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

  removeGalleryImage(index: number) {
    // Check if this is an existing image or a newly added one
    const existingCount = this.existingGalleryImageIds.length;
    
    if (index < existingCount) {
      // Removing an existing gallery image
      this.existingGalleryImageIds.splice(index, 1);
      this.galleryPreviews.splice(index, 1);
    } else {
      // Removing a newly added file
      const fileIndex = index - existingCount;
      this.galleryFiles.splice(fileIndex, 1);
      this.galleryPreviews.splice(index, 1);
    }
  }

  removeCoverImage() {
    this.selectedCoverFile = null;
    this.coverPreview = null;
    this.existingCoverImageId = ''; // Also clear existing ID
  }

  async saveProduct() {
    if (this.productForm.invalid) {
      this.errorMessage = 'admin.errors.form_invalid';
      this.markFormGroupTouched(this.productForm);
      return;
    }

    try {
      this.isSaving = true;
      this.isUploading = true;
      this.uploadProgress = 0;

      // 1. Upload cover image (only if new file selected)
      let coverImageUrl = this.coverPreview || '';
      let coverImageId = this.existingCoverImageId || ''; // Preserve existing if no new upload
      
      if (this.selectedCoverFile) {
        this.uploadProgress = 10;
        const coverMedia = await this.uploadImage(this.selectedCoverFile, 'cover');
        coverImageUrl = coverMedia.url;
        coverImageId = coverMedia.id || '';
        this.uploadProgress = 30;
      }

      // 2. Upload gallery images (combine existing + new uploads)
      const galleryMediaIds: string[] = [...this.existingGalleryImageIds]; // Start with existing
      
      if (this.galleryFiles.length > 0) {
        for (let i = 0; i < this.galleryFiles.length; i++) {
          const media = await this.uploadImage(this.galleryFiles[i], 'gallery');
          if (media.id) {
            galleryMediaIds.push(media.id);
          }
          this.uploadProgress = 30 + ((i + 1) / this.galleryFiles.length) * 50;
        }
      }

      this.isUploading = false;
      this.uploadProgress = 80;

      // 3. Prepare product data
      const formValue = this.productForm.value;
      const tagsArray = formValue.tags ? formValue.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t) : [];

      // Ensure slug is generated if not provided
      const productSlug = formValue.slug || this.generateSlug(formValue.title);

      // Get category slug for grosor field (needed for routing)
      const category = this.categories.find(c => c.id === formValue.categoryId);
      const categorySlug = category?.slug || '';

      const productData: Partial<Product> = {
        name: formValue.title,
        slug: productSlug,
        description: formValue.description || '',
        categoryId: formValue.categoryId,
        modelId: formValue.modelId,
        price: parseFloat(formValue.price) || 0,
        stock: parseInt(formValue.stock) || 0,
        sku: formValue.sku || '',
        status: formValue.status,
        active: formValue.status === 'published', // Set active based on status
        benefits: this.currentBenefits.length > 0 ? this.currentBenefits : undefined,
        specs: Object.keys(this.currentSpecs).length > 0 ? this.currentSpecs : undefined,
        imageUrl: coverImageUrl,
        coverImage: coverImageId,
        galleryImageIds: galleryMediaIds.length > 0 ? galleryMediaIds : undefined,
        tags: tagsArray,
        seo: {
          title: formValue.metaTitle || formValue.title,
          metaDescription: formValue.metaDescription || formValue.description?.substring(0, 160),
          ogImage: coverImageUrl
        }
      };

      this.uploadProgress = 90;

      // 4. Create or Update product
      if (this.isEditMode && this.editingProductId) {
        // Update existing product
        await this.productsService.updateProduct(this.editingProductId, productData);
        this.successMessage = 'Product updated successfully!';
      } else {
        // Create new product
        await this.productsService.addProduct(productData as Omit<Product, 'id'>);
        this.successMessage = 'Product created successfully!';
      }

      this.uploadProgress = 100;
      
      // Redirect to products list after 2 seconds
      setTimeout(() => {
        this.router.navigate(['/admin/products']);
      }, 2000);

    } catch (error: any) {
      console.error('Error saving product:', error);
      this.errorMessage = error.message || 'admin.errors.save_failed';
    } finally {
      this.isSaving = false;
      this.isUploading = false;
    }
  }

  private async uploadImage(file: File, type: 'cover' | 'gallery'): Promise<{ url: string; id: string }> {
    try {
      const uploadPath = `products/${Date.now()}_${file.name}`;
      
      // Wait for upload to complete and get download URL
      const uploadResult: UploadProgress = await lastValueFrom(
        this.storageService.uploadFile(file, uploadPath).pipe(
          filter((progress: UploadProgress) => progress.downloadURL !== undefined)
        )
      );
      
      const downloadURL = uploadResult.downloadURL;
      if (!downloadURL) {
        throw new Error('Failed to get download URL');
      }
      
      // Get image dimensions
      const dimensions = await this.getImageDimensions(file);
      
      const mediaInput: MediaCreateInput = {
        url: downloadURL,
        filename: file.name,
        storagePath: uploadPath,
        width: dimensions.width,
        height: dimensions.height,
        size: file.size,
        mimeType: file.type,
        uploadedBy: this.authService.getCurrentUser()?.uid || 'system',
        tags: [type]
      };

      // Save media document to Firestore
      const mediaId = await this.mediaService.createMedia(mediaInput);
      
      return { url: downloadURL, id: mediaId };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // Category dynamic creation
  onCategorySelectChange(event: any) {
    const value = event.target.value;
    if (value === '__new__') {
      this.showNewCategoryInput = true;
      this.productForm.patchValue({ categoryId: '' });
    }
  }

  async createNewCategory() {
    if (!this.newCategoryName.trim()) {
      return;
    }

    try {
      const slug = this.generateSlug(this.newCategoryName);
      const newCategory: Omit<Category, 'id'> = {
        name: this.newCategoryName.trim(),
        slug: slug,
        active: true,
        order: this.categories.length + 1
      };

      const categoryId = await this.categoryService.addCategory(newCategory);
      
      // Reload categories
      this.categories = await firstValueFrom(this.categoryService.getAllCategories());
      
      // Set the newly created category as selected
      this.productForm.patchValue({ categoryId: categoryId });
      
      // Reset
      this.showNewCategoryInput = false;
      this.newCategoryName = '';
      
      this.successMessage = 'Category created successfully!';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error) {
      console.error('Error creating category:', error);
      this.errorMessage = 'Failed to create category';
    }
  }

  cancelNewCategory() {
    this.showNewCategoryInput = false;
    this.newCategoryName = '';
  }

  // Model dynamic creation
  onModelSelectChange(event: any) {
    const value = event.target.value;
    if (value === '__new__') {
      this.showNewModelInput = true;
      this.productForm.patchValue({ modelId: '' });
    }
  }

  async createNewModel() {
    if (!this.newModelName.trim()) {
      return;
    }

    const categoryId = this.productForm.get('categoryId')?.value;
    if (!categoryId) {
      this.errorMessage = 'Please select a category first';
      return;
    }

    try {
      const slug = this.generateSlug(this.newModelName);
      const newModel: Omit<Model, 'id'> = {
        name: this.newModelName.trim(),
        slug: slug,
        categoryId: categoryId,
        active: true
      };

      const modelId = await this.modelService.addModel(newModel);
      
      // Reload models
      this.models = await firstValueFrom(this.modelService.getAllModels());
      this.filteredModels = this.models.filter(m => m.categoryId === categoryId);
      
      // Set the newly created model as selected
      this.productForm.patchValue({ modelId: modelId });
      
      // Reset
      this.showNewModelInput = false;
      this.newModelName = '';
      
      this.successMessage = 'Model created successfully!';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error) {
      console.error('Error creating model:', error);
      this.errorMessage = 'Failed to create model';
    }
  }

  cancelNewModel() {
    this.showNewModelInput = false;
    this.newModelName = '';
  }

  cancel() {
    this.router.navigate(['/admin/products']);
  }

  async logout() {
    try {
      await this.authService.signOutUser('/client/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  get statusOptions() {
    return [
      { value: 'published', label: 'Published' },
      { value: 'draft', label: 'Draft' },
      { value: 'archived', label: 'Archived' }
    ];
  }

  // Benefits Management
  get availableBenefitTemplates() {
    const categoryId = this.productForm.get('categoryId')?.value;
    if (!categoryId) {
      return this.benefitTemplates.filter(t => t.category === 'general');
    }
    
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return [];
    
    return this.benefitTemplates.filter(t => 
      t.category === category.slug || t.category === 'general'
    );
  }

  addBenefit(template: BenefitTemplate) {
    if (this.currentBenefits.length >= 4) return;
    
    const benefit: ProductBenefit = {
      icon: template.icon,
      iconColor: template.iconColor,
      title: template.title,
      description: template.description
    };
    
    this.currentBenefits.push(benefit);
  }

  removeBenefit(index: number) {
    this.currentBenefits.splice(index, 1);
  }

  getBenefitIconPath(iconType: string): string {
    const iconPaths: Record<string, string> = {
      'performance': 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
      'efficiency': 'M13 10V3L4 14h7v7l9-11h-7z',
      'reliability': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'support': 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
      'quality': 'M5 13l4 4L19 7',
      'security': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      'warranty': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      'design': 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      'value': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    };
    return iconPaths[iconType] || iconPaths['performance'];
  }

  // Technical Specifications Management
  getCurrentSpecs(): Array<{key: string, value: any}> {
    if (!this.currentSpecs || Object.keys(this.currentSpecs).length === 0) {
      return [];
    }
    return Object.entries(this.currentSpecs).map(([key, value]) => ({ key, value }));
  }

  addSpec() {
    if (!this.newSpecKey || !this.newSpecValue) return;
    
    const key = this.newSpecKey.trim();
    const value = this.newSpecValue.trim();
    
    if (key && value) {
      this.currentSpecs[key] = value;
      this.newSpecKey = '';
      this.newSpecValue = '';
    }
  }

  removeSpec(key: string) {
    delete this.currentSpecs[key];
  }

  applySpecTemplate(template: { key: string; label: string; placeholder: string }) {
    this.newSpecKey = template.key;
    this.newSpecValue = '';
  }

  getMiningSpecTemplates() {
    return [
      { key: 'hashRate', label: 'Hash Rate', placeholder: '110 TH/s' },
      { key: 'powerConsumption', label: 'Power', placeholder: '3250W' },
      { key: 'efficiency', label: 'Efficiency', placeholder: '29.5 J/TH' },
      { key: 'algorithm', label: 'Algorithm', placeholder: 'SHA-256' },
      { key: 'chipType', label: 'Chip Type', placeholder: '7nm ASIC' },
      { key: 'cooling', label: 'Cooling', placeholder: 'Dual Fan System' },
      { key: 'dimensions', label: 'Dimensions', placeholder: '370×195×290mm' },
      { key: 'weight', label: 'Weight', placeholder: '13.2 kg' },
      { key: 'temperature', label: 'Temperature', placeholder: '0-40°C' },
      { key: 'network', label: 'Network', placeholder: 'Ethernet' },
      { key: 'voltage', label: 'Voltage', placeholder: '220V' },
      { key: 'warranty', label: 'Warranty', placeholder: '180 days' },
      { key: 'noiseLevel', label: 'Noise Level', placeholder: '75 dB' },
    ];
  }

  getAccessorySpecTemplates() {
    return [
      { key: 'material', label: 'Material', placeholder: 'Stainless Steel' },
      { key: 'dimensions', label: 'Dimensions', placeholder: '5cm × 2cm' },
      { key: 'weight', label: 'Weight', placeholder: '15g' },
      { key: 'finish', label: 'Finish', placeholder: 'Polished Chrome' },
      { key: 'color', label: 'Color', placeholder: 'Silver' },
      { key: 'packaging', label: 'Packaging', placeholder: 'Gift Box Included' },
    ];
  }

  getWalletSpecTemplates() {
    return [
      { key: 'screenSize', label: 'Screen Size', placeholder: '128×64 pixels' },
      { key: 'connectivity', label: 'Connectivity', placeholder: 'USB-C, Bluetooth' },
      { key: 'compatibility', label: 'Compatibility', placeholder: 'Windows, macOS, Linux, Android, iOS' },
      { key: 'supportedCoins', label: 'Supported Coins', placeholder: '5500+ cryptocurrencies' },
      { key: 'securityChip', label: 'Security Chip', placeholder: 'CC EAL5+ certified' },
      { key: 'battery', label: 'Battery', placeholder: 'Rechargeable Li-ion' },
      { key: 'dimensions', label: 'Dimensions', placeholder: '62.39mm × 17.4mm × 8.24mm' },
      { key: 'weight', label: 'Weight', placeholder: '34g' },
      { key: 'certifications', label: 'Certifications', placeholder: 'CE, FCC' },
    ];
  }

  formatSpecLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}
