import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, map, Observable, of, combineLatest } from 'rxjs';
import { Product } from '../models/product';
import { Cart, CartItem } from '../models/cart';
import { Firestore, doc, docData, setDoc, Timestamp, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { SettingsService } from './settings.service';

// Legacy support for old CartItem interface
interface LegacyCartItem {
  product: Product;
  qty: number;
}

interface LegacyCartState {
  items: LegacyCartItem[];
}

const LS_KEY = 'ts_cart_v1';
const ANON_CART_KEY = 'ts_anon_cart_id';

@Injectable({ providedIn: 'root' })
export class CartService {
  private platformId = inject(PLATFORM_ID);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private settingsService = inject(SettingsService);
  
  private cartState$ = new BehaviorSubject<Cart | null>(null);
  readonly cart$ = this.cartState$.asObservable();
  readonly count$ = this.cart$.pipe(
    map(cart => cart?.items.reduce((sum, item) => sum + item.qty, 0) || 0)
  );

  // Track current user to avoid duplicate loads
  private currentUserId: string | null = null;

  constructor() {
    // Debug: Expose auth state checker
    if (typeof window !== 'undefined') {
      (window as any).checkAuthState = () => {
        const user = this.auth.currentUser;
        console.log('=== AUTH STATE DEBUG ===');
        console.log('Current User:', user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        } : 'NOT LOGGED IN');
        console.log('Cart State:', this.cartState$.value);
        console.log('=======================');
        return user;
      };
    }

    // Subscribe to auth state changes to sync cart
    // Note: This fires immediately with null, then again with user when auth loads
    this.auth.onAuthStateChanged(user => {
      const userId = user?.uid || null;
      
      // Skip if this is the same user we already loaded
      if (userId === this.currentUserId) {
        console.log('[CartService] Auth state unchanged, skipping reload');
        return;
      }
      
      console.log('[CartService] Auth state changed:', user ? `User: ${user.uid} (${user.email})` : 'No user (anonymous)');
      this.currentUserId = userId;
      
      if (user) {
        console.log('[CartService] User authenticated, loading cart for:', user.uid);
        this.loadUserCart(user.uid);
      } else {
        console.log('[CartService] No user, loading anonymous cart');
        this.loadAnonymousCart();
      }
    });

    // Also check immediately if user is already logged in (for SSR/fast refresh cases)
    setTimeout(() => {
      const currentUser = this.auth.currentUser;
      if (currentUser && currentUser.uid !== this.currentUserId) {
        console.log('[CartService] User already logged in on init, ensuring cart is loaded:', currentUser.uid);
        // Only reload if cart is still anonymous
        const currentCart = this.cartState$.value;
        if (!currentCart || currentCart.id?.startsWith('anon_') || !currentCart.id) {
          this.currentUserId = currentUser.uid;
          this.loadUserCart(currentUser.uid);
        }
      }
    }, 100);
  }

  /**
   * Load user's cart from Firestore
   */
  private async loadUserCart(uid: string) {
    console.log('[CartService] loadUserCart called for uid:', uid);
    
    // Check if we have an anonymous cart to migrate
    const currentCart = this.cartState$.value;
    const hasAnonymousCart = currentCart && currentCart.id?.startsWith('anon_') && currentCart.items.length > 0;
    
    if (hasAnonymousCart) {
      console.log('[CartService] Found anonymous cart with items, migrating to user cart:', currentCart);
      // Migrate anonymous cart to user cart
      const userCart = {
        ...currentCart,
        id: uid,
        uid: uid
      };
      await this.saveCart(userCart);
      
      // Clear anonymous cart from localStorage
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem(ANON_CART_KEY);
      }
      
      console.log('[CartService] Migrated anonymous cart to user cart');
      return;
    }
    
    // Load existing user cart
    const cartRef = doc(this.firestore, `carts/${uid}`);
    docData(cartRef, { idField: 'id' }).pipe(
      tap(cart => console.log('[CartService] Loaded user cart from Firestore:', cart)),
      catchError(err => {
        console.error('[CartService] Error loading user cart:', err);
        // Create empty cart with user ID
        const emptyCart = this.createEmptyCart(uid);
        emptyCart.uid = uid;
        console.log('[CartService] Creating empty user cart:', emptyCart);
        return of(emptyCart);
      })
    ).subscribe(cart => {
      const cartData = cart as Cart;
      // Ensure cart has the correct user ID
      if (cartData && !cartData.id) {
        cartData.id = uid;
        cartData.uid = uid;
      }
      // Recalculate totals in case they're stale
      const cartWithTotals = cartData && cartData.items?.length > 0 
        ? this.calculateTotals(cartData) 
        : cartData;
      console.log('[CartService] User cart with recalculated totals:', cartWithTotals);
      this.cartState$.next(cartWithTotals);
    });
  }

  /**
   * Load anonymous cart (browser-only, localStorage temp ID)
   */
  private loadAnonymousCart() {
    if (!isPlatformBrowser(this.platformId)) {
      this.cartState$.next(this.createEmptyCart());
      return;
    }

    // Try to get existing anonymous cart ID
    let anonId = localStorage.getItem(ANON_CART_KEY);
    
    if (!anonId) {
      // Generate new anonymous cart ID
      anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(ANON_CART_KEY, anonId);
    }

    // Load from Firestore or create empty
    const cartRef = doc(this.firestore, `carts/${anonId}`);
    docData(cartRef, { idField: 'id' }).pipe(
      catchError(() => of(this.createEmptyCart(anonId!)))
    ).subscribe(cart => {
      const cartData = cart as Cart;
      // Recalculate totals in case they're stale
      const cartWithTotals = cartData && cartData.items?.length > 0 
        ? this.calculateTotals(cartData) 
        : cartData;
      this.cartState$.next(cartWithTotals);
    });
  }

  /**
   * Create an empty cart
   */
  private createEmptyCart(id?: string): Cart {
    return {
      id,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  }

  /**
   * Calculate cart totals
   */
  private calculateTotals(cart: Cart): Cart {
    const subtotal = cart.items.reduce((sum, item) => {
      const itemTotal = (item.unitPrice * item.qty);
      console.log(`[CartService] Item: ${item.name}, Price: ${item.unitPrice}, Qty: ${item.qty}, Subtotal: ${itemTotal}`);
      return sum + itemTotal;
    }, 0);
    const shipping = cart.shipping || 0;
    const tax = cart.tax || 0;
    const discount = cart.discount || 0;
    const total = subtotal + shipping + tax - discount;

    console.log(`[CartService] Cart totals - Subtotal: ${subtotal}, Shipping: ${shipping}, Tax: ${tax}, Discount: ${discount}, Total: ${total}`);

    return {
      ...cart,
      subtotal,
      total,
      updatedAt: Timestamp.now()
    };
  }

  /**
   * Update shipping cost manually (used when dynamic shipping is disabled)
   */
  async updateShippingCost(cost: number, methodId?: string): Promise<void> {
    const currentCart = this.cartState$.value;
    if (!currentCart) {
      return;
    }

    currentCart.shipping = Math.max(0, Number.isFinite(cost) ? cost : 0);
    if (methodId) {
      currentCart.shippingMethodId = methodId;
    }

    await this.saveCart(currentCart);
  }

  /**
   * Save cart to Firestore
   */
  private async saveCart(cart: Cart): Promise<void> {
    if (!cart.id) {
      console.error('Cannot save cart without ID');
      return;
    }

    const cartRef = doc(this.firestore, `carts/${cart.id}`);
    const cartWithTotals = this.calculateTotals(cart);
    
    // Filter out undefined values to prevent Firestore errors
    const cleanCart = this.removeUndefinedFields({
      ...cartWithTotals,
      updatedAt: serverTimestamp()
    });
    
    try {
      await setDoc(cartRef, cleanCart);
      this.cartState$.next(cartWithTotals);
    } catch (err) {
      console.error('Error saving cart:', err);
      throw err;
    }
  }

  /**
   * Remove undefined fields from object (Firestore doesn't accept undefined)
   */
  private removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (Array.isArray(obj[key])) {
          cleaned[key] = obj[key].map((item: any) => 
            typeof item === 'object' && item !== null 
              ? this.removeUndefinedFields(item) 
              : item
          );
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !(obj[key] instanceof Timestamp)) {
          cleaned[key] = this.removeUndefinedFields(obj[key]);
        } else {
          cleaned[key] = obj[key];
        }
      }
    }
    return cleaned;
  }

  /**
   * Add product to cart
   */
  async add(product: Product, qty = 1): Promise<void> {
    console.log('[CartService] Adding product to cart:', { 
      id: product.id, 
      name: product.name, 
      price: product.price,
      qty 
    });

    // Get inventory settings
    const settings = await this.settingsService.getSettings();
    
    // Check inventory if tracking is enabled
    if (settings.trackInventory) {
      const productStock = product.stock || 0;
      
      // Check if product is out of stock and backorders are disabled
      if (productStock <= 0 && !settings.allowBackorders) {
        console.warn('[CartService] Product out of stock and backorders disabled:', product.name);
        throw new Error(`Product "${product.name}" is out of stock`);
      }
      
      // Check if requested quantity exceeds available stock (when backorders disabled)
      if (!settings.allowBackorders && qty > productStock) {
        console.warn('[CartService] Requested quantity exceeds stock:', { requested: qty, available: productStock });
        throw new Error(`Only ${productStock} units available for "${product.name}"`);
      }
      
      console.log('[CartService] Inventory check passed:', { 
        stock: productStock, 
        requested: qty, 
        allowBackorders: settings.allowBackorders 
      });
    } else {
      console.log('[CartService] Inventory tracking disabled, allowing unlimited quantity');
    }

    let currentCart = this.cartState$.value;
    
    // If no cart exists, create one
    if (!currentCart || !currentCart.id) {
      console.log('[CartService] No cart exists, creating new cart');
      const user = this.auth.currentUser;
      
      if (user) {
        // Create user cart
        currentCart = this.createEmptyCart(user.uid);
        currentCart.uid = user.uid;
        console.log('[CartService] Created user cart:', currentCart);
      } else {
        // Create anonymous cart
        if (isPlatformBrowser(this.platformId)) {
          let anonId = localStorage.getItem(ANON_CART_KEY);
          if (!anonId) {
            anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(ANON_CART_KEY, anonId);
          }
          currentCart = this.createEmptyCart(anonId);
          console.log('[CartService] Created anonymous cart:', currentCart);
        } else {
          console.error('[CartService] Cannot create cart on server');
          return;
        }
      }
    }
    
    // Check if item already exists
    const existingItemIndex = currentCart.items.findIndex(
      item => item.productId === product.id
    );

    if (existingItemIndex >= 0) {
      // Check total quantity if inventory tracking enabled
      if (settings.trackInventory && !settings.allowBackorders) {
        const newTotalQty = currentCart.items[existingItemIndex].qty + qty;
        const productStock = product.stock || 0;
        if (newTotalQty > productStock) {
          console.warn('[CartService] Total cart quantity would exceed stock:', { 
            currentQty: currentCart.items[existingItemIndex].qty, 
            adding: qty, 
            total: newTotalQty, 
            available: productStock 
          });
          throw new Error(`Cannot add more. Only ${productStock} units available for "${product.name}"`);
        }
      }
      
      // Update quantity
      currentCart.items[existingItemIndex].qty += qty;
      console.log('[CartService] Updated existing item quantity:', currentCart.items[existingItemIndex]);
    } else {
      // Add new item
      const newItem: CartItem = {
        productId: product.id!,
        name: product.name,
        qty,
        unitPrice: product.price || 0,
        currency: 'USD',
        priceSnapshotAtAdd: product.price || 0,
        ...(product.imageUrl && { imageUrl: product.imageUrl }),
        ...(product.sku && { sku: product.sku }),
        ...(product.grosor && { grosor: product.grosor })
      };
      console.log('[CartService] Created new cart item:', newItem);
      currentCart.items.push(newItem);
    }

    await this.saveCart(currentCart);
  }

  /**
   * Remove item from cart
   */
  async remove(productId: string): Promise<void> {
    const currentCart = this.cartState$.value;
    if (!currentCart) return;

    currentCart.items = currentCart.items.filter(item => item.productId !== productId);
    await this.saveCart(currentCart);
  }

  /**
   * Update item quantity
   */
  async updateQty(productId: string, qty: number): Promise<void> {
    const currentCart = this.cartState$.value;
    if (!currentCart) return;

    const item = currentCart.items.find(i => i.productId === productId);
    if (item) {
      item.qty = Math.max(1, Math.floor(qty));
      await this.saveCart(currentCart);
    }
  }

  /**
   * Clear cart
   */
  async clear(): Promise<void> {
    const currentCart = this.cartState$.value;
    if (!currentCart) return;

    currentCart.items = [];
    await this.saveCart(currentCart);
  }

  /**
   * Get current cart snapshot
   */
  snapshot(): Cart | null {
    return this.cartState$.value;
  }

  /**
   * Migrate anonymous cart to user cart on sign-in
   */
  async migrateAnonymousCart(uid: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const anonId = localStorage.getItem(ANON_CART_KEY);
    if (!anonId) return;

    const anonCart = this.cartState$.value;
    if (!anonCart || anonCart.items.length === 0) {
      // No items to migrate, just cleanup
      localStorage.removeItem(ANON_CART_KEY);
      return;
    }

    // Load user's existing cart
    const userCartRef = doc(this.firestore, `carts/${uid}`);
    let userCart: Cart;
    
    try {
      const userCartDoc = await docData(userCartRef, { idField: 'id' }).pipe(
        catchError(() => of(null))
      ).toPromise();
      
      userCart = userCartDoc as Cart || this.createEmptyCart(uid);
    } catch {
      userCart = this.createEmptyCart(uid);
    }

    // Merge anonymous cart items into user cart
    for (const anonItem of anonCart.items) {
      const existingItem = userCart.items.find(i => i.productId === anonItem.productId);
      if (existingItem) {
        existingItem.qty += anonItem.qty;
      } else {
        userCart.items.push(anonItem);
      }
    }

    // Save merged cart
    await this.saveCart(userCart);

    // Delete anonymous cart and cleanup
    try {
      const anonCartRef = doc(this.firestore, `carts/${anonId}`);
      // Note: Firestore deleteDoc needs to be imported separately
      // For now, we'll just clear localStorage
      localStorage.removeItem(ANON_CART_KEY);
    } catch (err) {
      console.error('Error deleting anonymous cart:', err);
    }
  }

  /**
   * Legacy support: Load from localStorage and migrate
   */
  private migrateLegacyCart() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const legacyData = localStorage.getItem(LS_KEY);
      if (!legacyData) return;

      const legacyCart: LegacyCartState = JSON.parse(legacyData);
      if (legacyCart.items.length === 0) return;

      // Convert legacy items to new format
      const currentCart = this.cartState$.value || this.createEmptyCart();
      
      for (const legacyItem of legacyCart.items) {
        const newItem: CartItem = {
          productId: legacyItem.product.id!,
          name: legacyItem.product.name,
          qty: legacyItem.qty,
          unitPrice: legacyItem.product.price || 0,
          currency: 'USD',
          priceSnapshotAtAdd: legacyItem.product.price || 0,
          imageUrl: legacyItem.product.imageUrl,
          sku: legacyItem.product.sku,
          grosor: legacyItem.product.grosor
        };
        currentCart.items.push(newItem);
      }

      // Save to Firestore
      this.saveCart(currentCart);

      // Remove legacy cart
      localStorage.removeItem(LS_KEY);
    } catch (err) {
      console.error('Error migrating legacy cart:', err);
    }
  }

  /**
   * Update shipping address in cart
   */
  async updateShippingAddress(cartId: string, address: any): Promise<void> {
    const cartRef = doc(this.firestore, `carts/${cartId}`);
    await updateDoc(cartRef, {
      shippingAddress: address,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Clear cart after successful purchase
   */
  async clearCart(): Promise<void> {
    const currentCart = this.cartState$.value;
    if (!currentCart) return;

    // Create new empty cart with same uid
    const emptyCart = this.createEmptyCart(currentCart.uid || '');
    
    // Update Firestore if cart has an ID
    if (currentCart.id && !currentCart.id.startsWith('anon_')) {
      const cartRef = doc(this.firestore, `carts/${currentCart.id}`);
      await setDoc(cartRef, emptyCart);
    }

    // Update local state
    this.cartState$.next(emptyCart);
    
    console.log('[CartService] Cart cleared after purchase');
  }
}
