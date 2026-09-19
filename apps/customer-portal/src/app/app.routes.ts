import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { customerOnlyGuard } from './core/guards/customer-only.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [customerOnlyGuard],
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'profile',
        canActivate: [customerOnlyGuard],
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/account-list/account-list.component').then((m) => m.AccountListComponent),
      },
      {
        path: 'accounts/:id',
        loadComponent: () =>
          import('./features/accounts/account-detail/account-detail.component').then(
            (m) => m.AccountDetailComponent,
          ),
      },
      {
        path: 'transfers',
        canActivate: [customerOnlyGuard],
        loadComponent: () => import('./features/transfers/transfers.component').then((m) => m.TransfersComponent),
      },
      {
        path: 'cards',
        canActivate: [customerOnlyGuard],
        loadComponent: () => import('./features/cards/cards.component').then((m) => m.CardsComponent),
      },
      {
        path: 'payments',
        canActivate: [customerOnlyGuard],
        loadComponent: () => import('./features/payments/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'statement',
        canActivate: [customerOnlyGuard],
        loadComponent: () => import('./features/statement/statement.component').then((m) => m.StatementComponent),
      },
      {
        path: 'notifications',
        canActivate: [customerOnlyGuard],
        loadComponent: () =>
          import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent),
      },
      {
        path: 'admin/tenants/new',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/admin/create-tenant/create-tenant.component').then((m) => m.CreateTenantComponent),
      },
      {
        path: 'admin/tenants/:id',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/admin/tenant-detail/tenant-detail.component').then((m) => m.TenantDetailComponent),
      },
      {
        path: 'admin/customers/new',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/admin/create-customer/create-customer.component').then(
            (m) => m.CreateCustomerComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
