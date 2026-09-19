import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { Account, Balance, LedgerEntryLine } from '../../../core/models/api.models';
import { AccountService } from '../../../core/services/account.service';
import { LedgerService } from '../../../core/services/ledger.service';
import { AuthService } from '../../../core/services/auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { formatMoney } from '../../../shared/money.util';
import { StatusChipComponent } from '../../../shared/status-chip.component';

@Component({
  selector: 'app-account-detail',
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
  templateUrl: './account-detail.component.html',
  styleUrl: './account-detail.component.scss',
})
export class AccountDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly ledgerService = inject(LedgerService);
  private readonly customerService = inject(CustomerService);
  private readonly snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly account = signal<Account | null>(null);
  readonly balance = signal<Balance | null>(null);
  readonly entries = signal<LedgerEntryLine[]>([]);
  readonly counterpartyNames = signal<Map<string, string>>(new Map());

  readonly formatMoney = formatMoney;

  get accountId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.reload();
  }

  entryLabel(entry: LedgerEntryLine): string {
    if (entry.description) return entry.description;

    if (entry.counterpartyCustomerId) {
      const name = this.counterpartyNames().get(entry.counterpartyCustomerId);
      if (name) {
        return entry.direction === 'CREDIT' ? `Transfer from ${name}` : `Transfer to ${name}`;
      }
    }

    return entry.reference.charAt(0) + entry.reference.slice(1).toLowerCase();
  }

  private reload(): void {
    this.loading.set(true);
    this.accountService.get(this.accountId).subscribe((account) => {
      this.account.set(account);
      this.loading.set(false);
    });
    this.ledgerService.balance(this.accountId).subscribe((balance) => this.balance.set(balance));
    this.ledgerService.entries(this.accountId).subscribe((entries) => {
      this.entries.set(entries);
      this.loadCounterpartyNames(entries);
    });
  }

  private loadCounterpartyNames(entries: LedgerEntryLine[]): void {
    const ids = [...new Set(entries.map((e) => e.counterpartyCustomerId).filter((id): id is string => !!id))];
    if (ids.length === 0) return;

    forkJoin(
      Object.fromEntries(
        ids.map((id) => [id, this.customerService.getDisplayName(id).pipe(catchError(() => of(null)))]),
      ),
    ).subscribe((results) => {
      const names = new Map(this.counterpartyNames());
      for (const [id, result] of Object.entries(results)) {
        if (result) names.set(id, result.name);
      }
      this.counterpartyNames.set(names);
    });
  }

  activate(): void {
    this.runAction(this.accountService.activate(this.accountId), 'Account activated');
  }

  freeze(): void {
    this.runAction(this.accountService.freeze(this.accountId), 'Account frozen');
  }

  unfreeze(): void {
    this.runAction(this.accountService.unfreeze(this.accountId), 'Account unfrozen');
  }

  close(): void {
    this.runAction(this.accountService.close(this.accountId), 'Account closed');
  }

  private runAction(action: ReturnType<AccountService['activate']>, message: string): void {
    this.acting.set(true);
    action
      .pipe(
        switchMap(() => this.accountService.get(this.accountId)),
        finalize(() => this.acting.set(false)),
      )
      .subscribe((account) => {
        this.account.set(account);
        this.snackBar.open(message, 'OK', { duration: 3000 });
      });
  }
}
