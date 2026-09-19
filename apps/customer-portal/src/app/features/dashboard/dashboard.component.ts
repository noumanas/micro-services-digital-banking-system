import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { Account, ActivitySummary, Customer } from '../../core/models/api.models';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { LedgerService } from '../../core/services/ledger.service';
import { ReportingService } from '../../core/services/reporting.service';
import { formatMoney } from '../../shared/money.util';
import { StatusChipComponent } from '../../shared/status-chip.component';

interface AccountWithBalance extends Account {
  balance?: number;
}

const ACCOUNT_ICONS: Record<string, string> = {
  CURRENT: 'account_balance',
  SAVINGS: 'savings',
  BUSINESS: 'store',
  WALLET: 'account_balance_wallet',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly accountService = inject(AccountService);
  private readonly ledgerService = inject(LedgerService);
  private readonly reportingService = inject(ReportingService);

  readonly loading = signal(true);
  readonly customer = signal<Customer | null>(null);
  readonly accounts = signal<AccountWithBalance[]>([]);
  readonly activity = signal<ActivitySummary | null>(null);
  readonly totalsByCurrency = signal<{ currency: string; amount: number }[]>([]);

  readonly formatMoney = formatMoney;

  ngOnInit(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    forkJoin({
      customer: this.customerService.get(customerId),
      accounts: this.accountService.list(customerId),
      activity: this.reportingService.activity(customerId, 30),
    })
      .pipe(
        switchMap(({ customer, accounts, activity }) => {
          if (accounts.length === 0) {
            return of({ customer, accounts: [] as AccountWithBalance[], activity });
          }
          return forkJoin(
            accounts.map((account) =>
              this.ledgerService.balance(account.id).pipe(
                map((balance) => ({ ...account, balance: balance.balance }) as AccountWithBalance),
              ),
            ),
          ).pipe(map((accountsWithBalance) => ({ customer, accounts: accountsWithBalance, activity })));
        }),
      )
      .subscribe(({ customer, accounts, activity }) => {
        this.customer.set(customer);
        this.accounts.set(accounts);
        this.activity.set(activity);
        this.totalsByCurrency.set(this.groupByCurrency(accounts));
        this.loading.set(false);
      });
  }

  accountIcon(type: string): string {
    return ACCOUNT_ICONS[type] ?? 'account_balance';
  }

  private groupByCurrency(accounts: AccountWithBalance[]): { currency: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const account of accounts) {
      totals.set(account.currency, (totals.get(account.currency) ?? 0) + (account.balance ?? 0));
    }
    return Array.from(totals, ([currency, amount]) => ({ currency, amount }));
  }
}
