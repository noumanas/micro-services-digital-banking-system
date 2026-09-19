import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { Account, Card, Customer, RegisterResponse, Tenant, TenantUser } from '../../../core/models/api.models';
import { AccountService } from '../../../core/services/account.service';
import { CardService } from '../../../core/services/card.service';
import { CustomerService } from '../../../core/services/customer.service';
import { TenantService } from '../../../core/services/tenant.service';
import { formatMoney } from '../../../shared/money.util';
import { StatusChipComponent } from '../../../shared/status-chip.component';

function passwordsMatch(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  };
}

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    StatusChipComponent,
  ],
  templateUrl: './tenant-detail.component.html',
  styleUrl: './tenant-detail.component.scss',
})
export class TenantDetailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly tenantService = inject(TenantService);
  private readonly customerService = inject(CustomerService);
  private readonly accountService = inject(AccountService);
  private readonly cardService = inject(CardService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly tenant = signal<Tenant | null>(null);
  readonly users = signal<TenantUser[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly creatingAdmin = signal(false);
  readonly createdAdmin = signal<RegisterResponse | null>(null);
  readonly hidePassword = signal(true);

  readonly formatMoney = formatMoney;

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch() },
  );

  get tenantId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      tenant: this.tenantService.get(this.tenantId),
      users: this.tenantService.listUsers(this.tenantId),
      customers: this.customerService.listByTenant(this.tenantId),
      accounts: this.accountService.listByTenant(this.tenantId),
      cards: this.cardService.listByTenant(this.tenantId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ tenant, users, customers, accounts, cards }) => {
        this.tenant.set(tenant);
        this.users.set(users);
        this.customers.set(customers);
        this.accounts.set(accounts);
        this.cards.set(cards);
      });
  }

  customerLabel(customerId: string): string {
    const customer = this.customers().find((c) => c.id === customerId);
    return customer ? customer.email : customerId.slice(0, 8) + '…';
  }

  accountCurrency(accountId: string): string {
    return this.accounts().find((a) => a.id === accountId)?.currency ?? 'USD';
  }

  copyId(id: string): void {
    navigator.clipboard?.writeText(id);
    this.snackBar.open('Tenant ID copied', 'OK', { duration: 2000 });
  }

  createAdmin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.creatingAdmin.set(true);
    this.tenantService
      .createAdmin(this.tenantId, email, password)
      .pipe(finalize(() => this.creatingAdmin.set(false)))
      .subscribe((admin) => {
        this.createdAdmin.set(admin);
        this.form.reset();
        this.snackBar.open(`Tenant admin ${admin.email} created`, 'OK', { duration: 3000 });
        this.reload();
      });
  }
}
