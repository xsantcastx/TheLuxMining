import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then(m => m.HomePageComponent),
    title: 'TheLuxMining | page_titles.home'
  },
  {
    path: 'home',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'productos',
    loadComponent: () => import('./pages/productos/productos.page').then(m => m.ProductosPageComponent),
    title: 'TheLuxMining | page_titles.products'
  },
  {
    path: 'products/:slug',
    loadComponent: () => import('./pages/productos/detalle/detalle.component').then(m => m.DetalleComponent),
    title: 'TheLuxMining | page_titles.product_details'
  },
  {
    path: 'galeria',
    loadComponent: () => import('./pages/galeria/galeria.page').then(m => m.GaleriaPageComponent),
    title: 'TheLuxMining | page_titles.gallery'
  },
  {
    path: 'contacto',
    loadComponent: () => import('./pages/contacto/contacto.page').then(m => m.ContactoPageComponent),
    title: 'TheLuxMining | page_titles.contact'
  },
  {
    path: 'setup-guide',
    loadComponent: () => import('./pages/setup-guide/setup-guide.page').then(m => m.SetupGuidePage),
    title: 'TheLuxMining | Setup Guide'
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.page').then(m => m.CartPage),
    title: 'TheLuxMining | page_titles.cart'
  },
  // Checkout Routes
  {
    path: 'checkout/review',
    loadComponent: () => import('./pages/checkout/checkout-review.page').then(m => m.CheckoutReviewPage),
    canActivate: [authGuard],
    title: 'TheLuxMining | page_titles.checkout_review'
  },
  {
    path: 'checkout/payment',
    loadComponent: () => import('./pages/checkout/payment.page').then(m => m.PaymentPage),
    canActivate: [authGuard],
    title: 'TheLuxMining | page_titles.payment'
  },
  {
    path: 'checkout/confirmation',
    loadComponent: () => import('./pages/checkout/confirmation.page').then(m => m.ConfirmationPage),
    canActivate: [authGuard],
    title: 'TheLuxMining | page_titles.order_confirmation'
  },
  // Client Area Routes
  {
    path: 'client/login',
    loadComponent: () => import('./pages/client/login/login.page').then(m => m.LoginPageComponent),
    title: 'TheLuxMining | page_titles.login'
  },
  {
    path: 'client/register',
    loadComponent: () => import('./pages/client/register/register.page').then(m => m.RegisterPageComponent),
    title: 'TheLuxMining | page_titles.register'
  },
  {
    path: 'client/profile',
    loadComponent: () => import('./pages/client/profile/profile.page').then(m => m.ProfilePageComponent),
    canActivate: [authGuard],
    title: 'TheLuxMining | page_titles.profile'
  },
  {
    path: 'client/orders',
    loadComponent: () => import('./pages/client/orders/orders.page').then(m => m.OrdersPageComponent),
    canActivate: [authGuard],
    title: 'TheLuxMining | page_titles.orders'
  },
  // Admin Panel Routes
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/dashboard/dashboard.page').then(m => m.AdminDashboardComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.admin_dashboard'
  },
  {
    path: 'admin/products',
    loadComponent: () => import('./pages/admin/products/products-admin.page').then(m => m.ProductsAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.product_management'
  },
  {
    path: 'admin/products/quick-add',
    loadComponent: () => import('./pages/admin/products/quick-add-product.page').then(m => m.QuickAddProductComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.quick_add_product'
  },
  {
    path: 'admin/gallery',
    loadComponent: () => import('./pages/admin/gallery/gallery-admin.page').then(m => m.GalleryAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.gallery_management'
  },
  {
    path: 'admin/orders',
    loadComponent: () => import('./pages/admin/orders/orders-admin.page').then(m => m.OrdersAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.order_management'
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./pages/admin/users/users-admin.page').then(m => m.UsersAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.user_management'
  },
  {
    path: 'admin/benefit-templates',
    loadComponent: () => import('./pages/admin/benefit-templates/benefit-templates-admin.page').then(m => m.BenefitTemplatesAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.benefit_templates'
  },
  {
    path: 'admin/analytics',
    loadComponent: () => import('./pages/admin/analytics/analytics-admin.page').then(m => m.AnalyticsAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.analytics'
  },
  {
    path: 'admin/settings',
    loadComponent: () => import('./pages/admin/settings/settings-admin.page').then(m => m.SettingsAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.settings'
  },
  {
    path: 'admin/email-templates',
    loadComponent: () => import('./pages/admin/email-templates/email-templates-admin.page').then(m => m.EmailTemplatesAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.email_templates'
  },
  {
    path: 'admin/size-groups',
    loadComponent: () => import('./pages/admin/size-groups/size-groups-admin.page').then(m => m.SizeGroupsAdminComponent),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.size_groups'
  },
  {
    path: 'admin/reviews',
    loadComponent: () => import('./pages/admin/reviews/reviews.page').then(m => m.AdminReviewsPage),
    canActivate: [adminGuard],
    title: 'TheLuxMining | page_titles.reviews'
  },
  {
    path: 'admin/sitemap',
    loadComponent: () => import('./pages/admin/sitemap/sitemap.page').then(m => m.AdminSitemapPage),
    canActivate: [adminGuard],
    title: 'TheLuxMining | Sitemap Generator'
  },
  {
    path: 'admin/setup-guide',
    loadComponent: () => import('./pages/admin/setup-guide-admin/setup-guide-admin.page').then(m => m.SetupGuideAdminPage),
    canActivate: [adminGuard],
    title: 'TheLuxMining | Setup Guide Management'
  },
  {
    path: 'maintenance',
    loadComponent: () => import('./pages/maintenance/maintenance.page').then(m => m.MaintenancePage),
    title: 'Site Maintenance - TheLuxMining'
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found.page').then(m => m.NotFoundPageComponent),
    title: 'TheLuxMining | page_titles.not_found'
  },
  {
    path: '**',
    redirectTo: '404'
  }
];
