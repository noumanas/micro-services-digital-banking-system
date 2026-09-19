import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  customerOnly?: boolean;
}

// A staff session (BANK_ADMIN, SUPER_ADMIN, ...) has no Customer/KYC record
// of its own, so only "Accounts" (which already adapts to a tenant-wide
// management view for staff) makes sense — everything else here assumes
// "my own" banking data and is filtered out for staff in navItems below.
const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'space_dashboard', customerOnly: true },
  { path: 'profile', label: 'Profile & KYC', icon: 'badge', customerOnly: true },
  { path: 'accounts', label: 'Accounts', icon: 'account_balance' },
  { path: 'transfers', label: 'Transfers', icon: 'sync_alt', customerOnly: true },
  { path: 'cards', label: 'Cards', icon: 'credit_card', customerOnly: true },
  { path: 'payments', label: 'Payments', icon: 'payments', customerOnly: true },
  { path: 'statement', label: 'Statement', icon: 'receipt_long', customerOnly: true },
  { path: 'notifications', label: 'Notifications', icon: 'notifications', customerOnly: true },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { path: 'admin/tenants/new', label: 'Tenants', icon: 'apartment' },
  { path: 'admin/customers/new', label: 'Add customer', icon: 'person_add' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

  readonly navItems = this.auth.isStaff ? NAV_ITEMS.filter((item) => !item.customerOnly) : NAV_ITEMS;
  readonly adminNavItems = ADMIN_NAV_ITEMS;
  readonly user = this.auth.currentUser;
  readonly isSuperAdmin = this.auth.hasPermission('tenant:read');
  readonly isStaff = this.auth.isStaff;

  readonly isMobile = signal(false);
  readonly sidenavOpened = signal(true);

  get primaryRole(): string {
    const role = this.user?.roles[0] ?? 'CUSTOMER';
    return role.replace(/_/g, ' ').toLowerCase();
  }

  get initials(): string {
    const role = this.user?.roles[0] ?? 'C';
    return role.slice(0, 1).toUpperCase();
  }

  // Visually distinguishes the elevated roles (SUPER_ADMIN especially) from
  // an ordinary customer session in the toolbar badge and avatar.
  get roleTier(): 'super-admin' | 'staff' | 'customer' {
    if (this.isSuperAdmin) return 'super-admin';
    return this.user?.roles[0] === 'CUSTOMER' || !this.user?.roles.length ? 'customer' : 'staff';
  }

  get roleIcon(): string {
    switch (this.roleTier) {
      case 'super-admin':
        return 'admin_panel_settings';
      case 'staff':
        return 'badge';
      default:
        return 'person';
    }
  }

  constructor() {
    this.breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isMobile.set(state.matches);
        this.sidenavOpened.set(!state.matches);
      });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isMobile()) {
          this.sidenavOpened.set(false);
        }
      });
  }

  toggleNav(): void {
    this.sidenavOpened.update((open) => !open);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
