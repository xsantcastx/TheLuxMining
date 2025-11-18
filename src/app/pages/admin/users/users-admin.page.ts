import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { AdminSidebarComponent } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { LoadingComponentBase } from '../../../core/classes/loading-component.base';

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AdminSidebarComponent],
  templateUrl: './users-admin.page.html',
  styleUrl: './users-admin.page.scss'
})
export class UsersAdminComponent extends LoadingComponentBase implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  users: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  searchTerm = '';
  filterRole: 'all' | 'admin' | 'client' = 'all';
  
  successMessage = '';
  
  showChangeRoleModal = false;
  selectedUser: UserProfile | null = null;
  newRole: 'admin' | 'client' = 'client';

  async ngOnInit() {
    await this.checkAdminAccess();
    await this.loadUsers();
  }

  private async checkAdminAccess() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/client/login']);
      return;
    }

    const isAdmin = await this.authService.isAdmin(user.uid);
    if (!isAdmin) {
      this.router.navigate(['/']);
      return;
    }
  }

  private async loadUsers() {
    await this.withLoading(async () => {
      // Get all users from Firestore users collection
      this.users = await this.authService.getAllUsers();
      this.applyFilters();
    }, true); // Show errors automatically
  }

  applyFilters() {
    let filtered = [...this.users];

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(term) ||
        user.displayName?.toLowerCase().includes(term)
      );
    }

    // Filter by role
    if (this.filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === this.filterRole);
    }

    this.filteredUsers = filtered;
  }

  onSearchChange() {
    this.applyFilters();
  }

  onRoleFilterChange() {
    this.applyFilters();
  }

  openChangeRoleModal(user: UserProfile) {
    this.selectedUser = user;
    this.newRole = user.role;
    this.showChangeRoleModal = true;
  }

  closeChangeRoleModal() {
    this.showChangeRoleModal = false;
    this.selectedUser = null;
  }

  async confirmChangeRole() {
    if (!this.selectedUser) return;

    try {
      await this.authService.updateUserRole(this.selectedUser.uid, this.newRole);
      
      // Update local user list
      const userIndex = this.users.findIndex(u => u.uid === this.selectedUser!.uid);
      if (userIndex !== -1) {
        this.users[userIndex].role = this.newRole;
      }
      
      this.applyFilters();
      this.successMessage = `User role updated to ${this.newRole}`;
      this.closeChangeRoleModal();

      setTimeout(() => {
        this.successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error updating user role:', error);
      this.errorMessage = 'Failed to update user role';
    }
  }

  async toggleUserStatus(user: UserProfile) {
    try {
      const newStatus = !user.disabled;
      await this.authService.updateUserStatus(user.uid, newStatus);
      
      // Update local user list
      const userIndex = this.users.findIndex(u => u.uid === user.uid);
      if (userIndex !== -1) {
        this.users[userIndex].disabled = newStatus;
      }
      
      this.applyFilters();
      this.successMessage = `User ${newStatus ? 'disabled' : 'enabled'} successfully`;

      setTimeout(() => {
        this.successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error updating user status:', error);
      this.errorMessage = 'Failed to update user status';
    }
  }

  getBadgeClass(role: string): string {
    return role === 'admin' 
      ? 'inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-bitcoin-gold/30 text-bitcoin-gold border border-bitcoin-gold/30' 
      : 'inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-bitcoin-orange/30 text-bitcoin-orange border border-bitcoin-orange/30';
  }

  getStatusBadgeClass(user: UserProfile): string {
    return user.disabled 
      ? 'inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-500/30 text-red-400 border border-red-500/30' 
      : 'inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-bitcoin-gold/30 text-bitcoin-gold border border-bitcoin-gold/30';
  }

  getUserInitials(user: UserProfile): string {
    if (user.displayName) {
      const parts = user.displayName.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.displayName.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'N/A';
    }
  }

  async logout() {
    try {
      await this.authService.signOutUser('/client/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
