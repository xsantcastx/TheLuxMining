import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SitemapService } from '../../../services/sitemap.service';
import { AuthService } from '../../../services/auth.service';
import { AdminSidebarComponent } from '../../../shared/components/admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-sitemap',
  standalone: true,
  imports: [CommonModule, TranslateModule, AdminSidebarComponent],
  template: `
<!-- Admin Sidebar -->
<app-admin-sidebar />

<div class="md:ml-64 min-h-screen bg-gradient-to-b from-[#0a0b0d] to-[#13151a]">
  <!-- Header -->
  <div class="bg-gradient-to-r from-bitcoin-dark via-[#13151a] to-bitcoin-dark border-b border-bitcoin-orange/20 shadow-bitcoin">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold bitcoin-gradient-text">Sitemap Generator</h1>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

    @if (error()) {
      <div class="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
        {{ error() }}
      </div>
    }

    @if (successMessage()) {
      <div class="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400">
        {{ successMessage() }}
      </div>
    }

    <!-- Stats Card -->
    <div class="grid md:grid-cols-4 gap-6 mb-8">
      <div class="bg-bitcoin-dark/40 border border-bitcoin-gray/20 rounded-xl p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-bitcoin-orange/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-bitcoin-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ stats().totalUrls }}</p>
            <p class="text-sm text-bitcoin-gray">Total URLs</p>
          </div>
        </div>
      </div>

      <div class="bg-bitcoin-dark/40 border border-bitcoin-gray/20 rounded-xl p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-bitcoin-gold/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-bitcoin-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ stats().staticPages }}</p>
            <p class="text-sm text-bitcoin-gray">Static Pages</p>
          </div>
        </div>
      </div>

      <div class="bg-bitcoin-dark/40 border border-bitcoin-gray/20 rounded-xl p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ stats().productPages }}</p>
            <p class="text-sm text-bitcoin-gray">Product Pages</p>
          </div>
        </div>
      </div>

      <div class="bg-bitcoin-dark/40 border border-bitcoin-gray/20 rounded-xl p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <p class="text-xs font-semibold text-white">{{ formatDate(stats().lastGenerated) }}</p>
            <p class="text-sm text-bitcoin-gray">Last Generated</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="bg-bitcoin-dark/40 border border-bitcoin-gray/20 rounded-xl p-8 mb-8">
      <h2 class="text-xl font-semibold text-white mb-6">Actions</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <button 
          (click)="generatePreview()"
          [disabled]="loading()"
          class="px-6 py-4 bg-bitcoin-orange/20 hover:bg-bitcoin-orange/30 border border-bitcoin-orange/30 text-bitcoin-orange rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          @if (loading()) {
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          } @else {
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          }
          Generate Preview
        </button>

        <button 
          (click)="downloadSitemap()"
          [disabled]="loading()"
          class="px-6 py-4 bg-bitcoin-gold/20 hover:bg-bitcoin-gold/30 border border-bitcoin-gold/30 text-bitcoin-gold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          Download sitemap.xml
        </button>

        <button 
          (click)="copyToClipboard()"
          [disabled]="loading() || !previewXml()"
          class="px-6 py-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Copy XML
        </button>
      </div>
    </div>

    <!-- Preview -->
    @if (previewXml()) {
      <div class="bg-bitcoin-dark/40 border border-bitcoin-gray/20 rounded-xl p-8">
        <h2 class="text-xl font-semibold text-white mb-4">Sitemap Preview</h2>
        <div class="bg-[#0a0b0d] border border-bitcoin-gray/20 rounded-lg p-4 overflow-auto max-h-96">
          <pre class="text-xs text-green-400 font-mono">{{ previewXml() }}</pre>
        </div>
        <p class="mt-4 text-sm text-bitcoin-gray">
          💡 Replace the file <code class="text-bitcoin-orange">public/sitemap.xml</code> with this generated content for production deployment.
        </p>
      </div>
    }
  </div>
</div>
  `
})
export class AdminSitemapPage implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  stats = signal({
    totalUrls: 0,
    staticPages: 0,
    productPages: 0,
    lastGenerated: new Date().toISOString()
  });
  previewXml = signal<string | null>(null);

  constructor(
    private sitemapService: SitemapService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadStats();
  }

  async loadStats() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const stats = await this.sitemapService.getSitemapStats();
      this.stats.set(stats);
    } catch (err: any) {
      console.error('Error loading sitemap stats:', err);
      this.error.set('Failed to load statistics');
    } finally {
      this.loading.set(false);
    }
  }

  async generatePreview() {
    this.loading.set(true);
    this.error.set(null);
    this.previewXml.set(null);

    try {
      const xml = await this.sitemapService.generateSitemap();
      this.previewXml.set(xml);
      await this.loadStats();
      this.successMessage.set('Sitemap generated successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (err: any) {
      console.error('Error generating sitemap:', err);
      this.error.set('Failed to generate sitemap');
    } finally {
      this.loading.set(false);
    }
  }

  async downloadSitemap() {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.sitemapService.downloadSitemap();
      this.successMessage.set('Sitemap downloaded successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (err: any) {
      console.error('Error downloading sitemap:', err);
      this.error.set('Failed to download sitemap');
    } finally {
      this.loading.set(false);
    }
  }

  async copyToClipboard() {
    const xml = this.previewXml();
    if (!xml) return;

    try {
      await navigator.clipboard.writeText(xml);
      this.successMessage.set('XML copied to clipboard!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (err) {
      this.error.set('Failed to copy to clipboard');
    }
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async logout() {
    await this.authService.signOutUser('/client/login');
  }
}
