import { Component, HostListener, inject, PLATFORM_ID, EventEmitter, Output, OnInit, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { LanguageSelectorComponent } from '../../../shared/components/language-selector/language-selector.component';
import { CartButtonComponent } from '../../../shared/components/cart-button/cart-button.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LanguageSelectorComponent, CartButtonComponent, TranslateModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  @Output() toggleCart = new EventEmitter<void>();

  private platformId = inject(PLATFORM_ID);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  
  scrolled = signal(false);
  mobileOpen = false;
  showUserMenu = false;
  
  // Auth state
  user$ = this.authService.user$;
  userProfile$ = this.authService.userProfile$;

  readonly totalItems = toSignal(
    this.cartService.count$,
    { initialValue: 0 }
  ) as () => number;

  ngOnInit() {
    // Set initial scroll state
    if (isPlatformBrowser(this.platformId)) {
      this.scrolled.set(window.scrollY > 8);
    }
  }

  @HostListener('window:scroll')
  onScroll() {
    // Only run in browser to avoid SSR issues
    if (isPlatformBrowser(this.platformId)) {
      this.scrolled.set(window.scrollY > 8);
    }
  }

  // Close user menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    this.showUserMenu = false;
  }

  // ESC to close user menu
  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.showUserMenu = false;
    }
  }

  activarCarrito(): void {
    this.toggleCart.emit();
  }

  closeMobile() {
    this.mobileOpen = false;
  }

  toggleMobile() {
    this.mobileOpen = !this.mobileOpen;
  }

  // User menu controls
  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    console.log('Closing user menu');
    this.showUserMenu = false;
  }

  // Auth methods
  async logout(): Promise<void> {
    console.log('Logging out user');
    await this.authService.signOutUser();
    this.closeMobile();
    this.closeUserMenu();
  }
}
