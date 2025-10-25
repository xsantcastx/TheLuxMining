import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AdminQuickActionsComponent } from '../../../shared/components/admin-quick-actions/admin-quick-actions.component';
import { ModelService } from '../../../services/model.service';
import { CategoryService } from '../../../services/category.service';
import { Model, Category } from '../../../models/catalog';
import { LoadingComponentBase } from '../../../core/classes/loading-component.base';
import { firstValueFrom } from 'rxjs';

type MessageType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-models-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AdminQuickActionsComponent],
  templateUrl: './models-admin.page.html',
  styleUrls: ['./models-admin.page.scss']
})
export class ModelsAdminComponent extends LoadingComponentBase implements OnInit {
  private modelService = inject(ModelService);
  private categoryService = inject(CategoryService);
  private translate = inject(TranslateService);

  models: Model[] = [];
  categories: Category[] = [];

  filterTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  showModal = false;
  isEditMode = false;
  selectedModel: Partial<Model> = {};
  originalSlug = '';
  textureHintsInput = '';
  defaultTagsInput = '';

  messageKey: string | null = null;
  messageType: MessageType = 'info';
  messageParams: Record<string, unknown> = {};
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  get filteredModels(): Model[] {
    const term = this.filterTerm.trim().toLowerCase();
    return this.models.filter(model => {
      const matchesStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'active' && model.active !== false) ||
        (this.statusFilter === 'inactive' && model.active === false);

      const matchesTerm =
        !term ||
        model.name.toLowerCase().includes(term) ||
        (model.slug ?? '').toLowerCase().includes(term);

      return matchesStatus && matchesTerm;
    });
  }

  async ngOnInit() {
    await Promise.all([this.loadCategories(), this.loadModels()]);
  }

  async loadModels() {
    await this.withLoading(async () => {
      const snapshot = await firstValueFrom(this.modelService.getAllModels());
      this.models = snapshot;
    }, true);
  }

  private async loadCategories() {
    try {
      const snapshot = await firstValueFrom(this.categoryService.getAllCategories());
      this.categories = snapshot;
    } catch (error) {
      console.error('[ModelsAdmin] Failed to load categories:', error);
    }
  }

  addNew() {
    this.selectedModel = {
      name: '',
      slug: '',
      active: true,
      categoryId: this.categories[0]?.id
    };
    this.isEditMode = false;
    this.originalSlug = '';
    this.textureHintsInput = '';
    this.defaultTagsInput = '';
    this.showModal = true;
  }

  edit(model: Model) {
    this.selectedModel = { ...model };
    this.isEditMode = true;
    this.originalSlug = model.slug ?? '';
    this.textureHintsInput = (model.textureHints ?? []).join('\n');
    this.defaultTagsInput = (model.defaultTags ?? []).join(', ');
    this.showModal = true;
  }

  async save() {
    const trimmedName = (this.selectedModel.name || '').trim();
    if (!trimmedName) {
      this.showMessage('admin.models.messages.name_required', 'error');
      return;
    }
    this.selectedModel.name = trimmedName;

    const sanitizedSlug = this.sanitizeSlug(this.selectedModel.slug || this.selectedModel.name);
    this.selectedModel.slug = sanitizedSlug;

    try {
      const slugChanged = !this.isEditMode || sanitizedSlug !== this.originalSlug;
      if (slugChanged) {
        const exists = await this.modelService.slugExists(
          sanitizedSlug,
          this.isEditMode ? this.selectedModel.id : undefined
        );
        if (exists) {
          this.showMessage('admin.models.messages.slug_exists', 'error', { slug: sanitizedSlug });
          return;
        }
      }

      const payload: Partial<Model> = {
        ...this.selectedModel,
        slug: sanitizedSlug,
        active: this.selectedModel.active !== false,
        textureHints: this.parseMultilineList(this.textureHintsInput),
        defaultTags: this.parseCommaList(this.defaultTagsInput)
      };

      if (this.isEditMode && this.selectedModel.id) {
        await this.modelService.updateModel(this.selectedModel.id, payload);
        this.showMessage('admin.models.messages.updated', 'success');
      } else {
        await this.modelService.addModel(payload as Omit<Model, 'id'>);
        this.showMessage('admin.models.messages.created', 'success');
      }

      await this.loadModels();
      this.closeModal();
    } catch (error) {
      console.error('[ModelsAdmin] Error saving model:', error);
      this.showMessage('admin.models.messages.save_failed', 'error');
    }
  }

  async delete(model: Model) {
    if (!model.id) {
      return;
    }

    const confirmMessage = this.translate.instant('admin.models.messages.confirm_delete', {
      name: model.name
    });

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await this.modelService.deleteModel(model.id);
      this.showMessage('admin.models.messages.deleted', 'success');
      await this.loadModels();
    } catch (error) {
      console.error('[ModelsAdmin] Error deleting model:', error);
      this.showMessage('admin.models.messages.delete_failed', 'error');
    }
  }

  closeModal() {
    this.showModal = false;
    this.selectedModel = {};
    this.textureHintsInput = '';
    this.defaultTagsInput = '';
  }

  generateSlug() {
    if (!this.selectedModel.name) {
      return;
    }
    this.selectedModel.slug = this.sanitizeSlug(this.selectedModel.name);
  }

  getCategoryName(categoryId: string | undefined): string {
    if (!categoryId) {
      return this.translate.instant('admin.models.table.unassigned');
    }
    const category = this.categories.find(item => item.id === categoryId);
    return category?.name || this.translate.instant('admin.models.table.unassigned');
  }

  trackByModelId(_index: number, model: Model): string {
    return model.id || model.slug;
  }

  private sanitizeSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private parseMultilineList(value: string): string[] | undefined {
    const items = value
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return items.length ? items : undefined;
  }

  private parseCommaList(value: string): string[] | undefined {
    const items = value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return items.length ? items : undefined;
  }

  private showMessage(key: string, type: MessageType, params?: Record<string, unknown>) {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }

    this.messageKey = key;
    this.messageType = type;
    this.messageParams = params ?? {};

    this.messageTimer = setTimeout(() => {
      this.messageKey = null;
      this.messageTimer = null;
    }, 4000);
  }
}
