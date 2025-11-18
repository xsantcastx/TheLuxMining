import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth.service';
import { AdminSidebarComponent } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { Firestore, collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp } from '@angular/fire/firestore';

interface OrderItem {
  productId: string;
  name: string;
  qty?: number;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  thickness?: string;
  sku?: string;
  image?: string;
  imageUrl?: string;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phoneE164?: string;
  email?: string;
  // Legacy fields
  street?: string;
  phone?: string;
}

interface Order {
  id?: string;
  orderNumber: string;
  createdAt?: any;
  date?: Date;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  subtotal?: number;
  shipping?: number;
  tax?: number;
  discount?: number;
  currency?: string;
  items: OrderItem[];
  itemCount?: number;
  userId?: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress?: ShippingAddress;
  shippingMethod?: string;
  trackingNumber?: string;
  tracking?: string;
  notes?: string;
  paymentIntentId?: string;
}

@Component({
  selector: 'app-orders-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AdminSidebarComponent],
  templateUrl: './orders-admin.page.html',
  styleUrl: './orders-admin.page.scss'
})
export class OrdersAdminComponent implements OnInit {
  private firestore: Firestore;
  
  orders = signal<Order[]>([]);
  selectedStatus: 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' = 'all';
  searchQuery = '';
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Detail modal
  showDetailModal = false;
  selectedOrder: Order | null = null;

  // Status update
  showStatusModal = false;
  orderToUpdate: Order | null = null;
  newStatus: Order['status'] = 'pending';
  
  // Track number update
  trackingNumber = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    firestore: Firestore
  ) {
    this.firestore = firestore;
  }

  ngOnInit(): void {
    // Check if user is admin
    this.authService.userProfile$.subscribe(profile => {
      if (!profile || profile.role !== 'admin') {
        console.log('Access denied: User is not admin');
        this.router.navigate(['/']);
      }
    });

    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    
    // Query all orders from Firestore
    const ordersRef = collection(this.firestore, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    
    onSnapshot(q, (snapshot) => {
      const orders: Order[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          orderNumber: data['orderNumber'],
          date: data['createdAt'] instanceof Timestamp 
            ? data['createdAt'].toDate() 
            : new Date(data['createdAt']),
          createdAt: data['createdAt'],
          status: data['status'] || 'pending',
          total: data['total'] || 0,
          subtotal: data['subtotal'],
          shipping: data['shipping'],
          tax: data['tax'],
          discount: data['discount'],
          currency: data['currency'] || 'USD',
          items: data['items'] || [],
          itemCount: data['itemCount'],
          userId: data['userId'],
          shippingAddress: data['shippingAddress'],
          shippingMethod: data['shippingMethod'],
          trackingNumber: data['trackingNumber'],
          notes: data['notes'],
          paymentIntentId: data['paymentIntentId'],
        });
      });
      
      this.orders.set(orders);
      this.isLoading.set(false);
    }, (error) => {
      console.error('Error loading orders:', error);
      this.errorMessage.set('Failed to load orders');
      this.isLoading.set(false);
    });
  }

  get filteredOrders(): Order[] {
    let filtered = [...this.orders()];

    // Filter by status
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === this.selectedStatus);
    }

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const orderNum = order.orderNumber?.toLowerCase() || '';
        const customerName = order.customer?.name?.toLowerCase() || '';
        const customerEmail = order.customer?.email?.toLowerCase() || '';
        const shippingName = order.shippingAddress?.firstName && order.shippingAddress?.lastName
          ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.toLowerCase()
          : '';
        
        return orderNum.includes(query) ||
               customerName.includes(query) ||
               customerEmail.includes(query) ||
               shippingName.includes(query);
      });
    }

    return filtered;
  }

  getStatusCount(status: string): number {
    if (status === 'all') {
      return this.orders().length;
    }
    return this.orders().filter(order => order.status === status).length;
  }

  getStatusClass(status: Order['status']): string {
    const classes: Record<Order['status'], string> = {
      pending: 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/30',
      processing: 'bg-blue-500/30 text-blue-400 border border-blue-500/30',
      shipped: 'bg-purple-500/30 text-purple-400 border border-purple-500/30',
      delivered: 'bg-bitcoin-gold/30 text-bitcoin-gold border border-bitcoin-gold/30',
      cancelled: 'bg-red-500/30 text-red-400 border border-red-500/30'
    };
    return classes[status];
  }

  getCustomerName(order: Order): string {
    if (order.customer?.name) {
      return order.customer.name;
    }
    
    const firstName = order.shippingAddress?.firstName || '';
    const lastName = order.shippingAddress?.lastName || '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return 'N/A';
  }

  getCustomerEmail(order: Order): string {
    return order.customer?.email || order.shippingAddress?.email || 'N/A';
  }

  openDetailModal(order: Order): void {
    this.selectedOrder = order;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedOrder = null;
  }

  openStatusModal(order: Order): void {
    this.orderToUpdate = order;
    this.newStatus = order.status;
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.orderToUpdate = null;
  }

  async updateStatus(): Promise<void> {
    if (!this.orderToUpdate || !this.orderToUpdate.id) return;

    try {
      // Update status in Firestore
      const orderRef = doc(this.firestore, 'orders', this.orderToUpdate.id);
      await updateDoc(orderRef, {
        status: this.newStatus,
        updatedAt: Timestamp.now()
      });

      this.successMessage.set('admin.status_updated');
      setTimeout(() => this.successMessage.set(''), 3000);
      
      this.closeStatusModal();
    } catch (error) {
      console.error('Error updating status:', error);
      this.errorMessage.set('Failed to update status');
      setTimeout(() => this.errorMessage.set(''), 3000);
    }
  }
  
  async updateTracking(): Promise<void> {
    if (!this.orderToUpdate || !this.orderToUpdate.id || !this.trackingNumber.trim()) return;

    try {
      const orderRef = doc(this.firestore, 'orders', this.orderToUpdate.id);
      await updateDoc(orderRef, {
        trackingNumber: this.trackingNumber,
        updatedAt: Timestamp.now()
      });

      this.successMessage.set('Tracking number updated');
      setTimeout(() => this.successMessage.set(''), 3000);
      
      this.trackingNumber = '';
    } catch (error) {
      console.error('Error updating tracking:', error);
      this.errorMessage.set('Failed to update tracking number');
      setTimeout(() => this.errorMessage.set(''), 3000);
    }
  }

  async logout(): Promise<void> {
    await this.authService.signOutUser('/client/login');
  }
}
