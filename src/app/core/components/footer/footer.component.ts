import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <footer class="bg-gradient-to-b from-[#13151a] to-[#0a0b0d] py-16 border-t border-bitcoin-orange/20">
      <div class="max-w-7xl mx-auto px-6">
        <div class="grid md:grid-cols-4 gap-8 mb-12">
          
          <!-- Logo and description -->
          <div class="md:col-span-2">
            <div class="flex items-center gap-3 mb-4">
              <img src="/assets/Logo.jpg" alt="TheLuxMining" class="h-10 w-10 rounded-lg shadow-bitcoin"/>
              <span class="font-serif text-xl font-semibold text-bitcoin-orange">TheLuxMining</span>
            </div>
            <p class="text-bitcoin-gray mb-6 max-w-md">
              {{ 'footer.description' | translate }}
            </p>
            <div class="flex gap-4">
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" 
                 class="w-10 h-10 bg-bitcoin-orange/20 rounded-full flex items-center justify-center text-bitcoin-orange hover:bg-bitcoin-orange hover:text-bitcoin-dark transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" 
                 class="w-10 h-10 bg-bitcoin-orange/20 rounded-full flex items-center justify-center text-bitcoin-orange hover:bg-bitcoin-orange hover:text-bitcoin-dark transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" 
                 class="w-10 h-10 bg-bitcoin-orange/20 rounded-full flex items-center justify-center text-bitcoin-orange hover:bg-bitcoin-orange hover:text-bitcoin-dark transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
            </div>
          </div>

          <!-- Quick links -->
          <div>
            <h3 class="font-semibold text-white mb-4">{{ 'footer.quick_links' | translate }}</h3>
            <ul class="space-y-2">
              <li><a routerLink="/" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">{{ 'nav.home' | translate }}</a></li>
              <li><a routerLink="/productos" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">{{ 'nav.products' | translate }}</a></li>
              <li><a routerLink="/galeria" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">{{ 'nav.gallery' | translate }}</a></li>
              <li><a routerLink="/contacto" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">{{ 'nav.contact' | translate }}</a></li>
            </ul>
          </div>

          <!-- Products -->
          <div>
            <h3 class="font-semibold text-white mb-4">{{ 'footer.products_title' | translate }}</h3>
            <ul class="space-y-2">
              <li><a routerLink="/productos/12mm" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">Flagship Series</a></li>
              <li><a routerLink="/productos/15mm" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">Professional Series</a></li>
              <li><a routerLink="/productos/20mm" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">Enterprise Series</a></li>
            </ul>
          </div>
        </div>

        <!-- Contact Info Section -->
        <div class="grid md:grid-cols-3 gap-6 mb-12 p-6 bg-bitcoin-dark/40 rounded-xl border border-bitcoin-orange/20">
          <div class="text-center">
            <h4 class="font-semibold text-bitcoin-gold mb-2">{{ 'footer.address' | translate }}</h4>
            <p class="text-bitcoin-gray text-sm">
              450 Serra Mall<br>
              Stanford, CA 94305<br>
              United States
            </p>
          </div>
          <div class="text-center">
            <h4 class="font-semibold text-bitcoin-gold mb-2">{{ 'footer.contact_info' | translate }}</h4>
            <p class="text-bitcoin-gray text-sm">
              <a href="tel:+16507232300" class="hover:text-bitcoin-orange transition-colors">+1 (650) 723-2300</a><br>
              <a href="mailto:info@theluxmining.com" class="hover:text-bitcoin-orange transition-colors">info@theluxmining.com</a>
            </p>
          </div>
          <div class="text-center">
            <h4 class="font-semibold text-bitcoin-gold mb-2">{{ 'footer.business_hours' | translate }}</h4>
            <p class="text-bitcoin-gray text-sm">
              Monday - Friday<br>
              9:00 AM - 6:00 PM PST
            </p>
          </div>
        </div>

        <!-- Bottom bar -->
        <div class="border-t border-bitcoin-orange/20 pt-8">
          <div class="flex flex-col md:flex-row justify-between items-center gap-4">
            <p class="text-bitcoin-gray text-sm">
              © 2025 TheLuxMining. {{ 'footer.rights' | translate }}.
            </p>
            <div class="flex gap-6 text-sm">
              <a href="#" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">{{ 'footer.privacy' | translate }}</a>
              <a href="#" class="text-bitcoin-gray hover:text-bitcoin-orange transition-colors">{{ 'footer.terms' | translate }}</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  `
})
export class FooterComponent {}