import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, forkJoin } from 'rxjs';
import { Account, Card, CardType } from '../../core/models/api.models';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { CardService } from '../../core/services/card.service';
import { formatMoney, toMinorUnits } from '../../shared/money.util';
import { StatusChipComponent } from '../../shared/status-chip.component';

const CARD_TYPES: CardType[] = ['VIRTUAL', 'PHYSICAL'];

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
  ],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.scss',
})
export class CardsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly cardService = inject(CardService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cardTypes = CARD_TYPES;
  readonly loading = signal(true);
  readonly issuing = signal(false);
  readonly acting = signal<string | null>(null);
  readonly simulatingId = signal<string | null>(null);
  readonly accounts = signal<Account[]>([]);
  readonly cards = signal<Card[]>([]);

  readonly form = this.fb.nonNullable.group({
    accountId: ['', Validators.required],
    type: this.fb.nonNullable.control<CardType>('VIRTUAL', [Validators.required]),
    dailyLimit: [500, [Validators.min(0)]],
  });

  readonly simulateForm = this.fb.nonNullable.group({
    amount: [10, [Validators.required, Validators.min(0.01)]],
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
    merchantName: ['Demo Merchant', Validators.required],
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    this.loading.set(true);
    forkJoin({
      accounts: this.accountService.list(customerId),
      cards: this.cardService.list(customerId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ accounts, cards }) => {
        this.accounts.set(accounts);
        this.cards.set(cards);
      });
  }

  readonly formatMoney = formatMoney;

  accountLabel(accountId: string): string {
    const account = this.accounts().find((a) => a.id === accountId);
    return account ? `${account.type} · ${account.currency} · ${account.id.slice(0, 8)}` : accountId;
  }

  cardLimitLabel(card: Card): string {
    return this.formatMoney(card.dailyLimit, this.accountCurrency(card.accountId));
  }

  accountCurrency(accountId: string): string {
    return this.accounts().find((a) => a.id === accountId)?.currency ?? 'USD';
  }

  issue(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { accountId, type, dailyLimit } = this.form.getRawValue();
    this.issuing.set(true);
    this.cardService
      .issue(accountId, type, toMinorUnits(dailyLimit))
      .pipe(finalize(() => this.issuing.set(false)))
      .subscribe(() => {
        this.snackBar.open('Card issued', 'OK', { duration: 3000 });
        this.reload();
      });
  }

  activate(card: Card): void {
    this.acting.set(card.id);
    this.cardService
      .activate(card.id)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe(() => {
        this.snackBar.open('Card activated', 'OK', { duration: 3000 });
        this.reload();
      });
  }

  block(card: Card): void {
    this.acting.set(card.id);
    this.cardService
      .block(card.id)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe(() => {
        this.snackBar.open('Card blocked', 'OK', { duration: 3000 });
        this.reload();
      });
  }

  toggleSimulate(card: Card): void {
    this.simulatingId.set(this.simulatingId() === card.id ? null : card.id);
  }

  simulatePurchase(card: Card): void {
    if (this.simulateForm.invalid) {
      this.simulateForm.markAllAsTouched();
      return;
    }

    const { amount, currency, merchantName } = this.simulateForm.getRawValue();
    this.acting.set(card.id);
    this.cardService
      .simulateTransaction(card.id, toMinorUnits(amount), currency, merchantName)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe((txn) => {
        this.snackBar.open(
          txn.status === 'APPROVED' ? 'Purchase approved' : `Purchase declined: ${txn.declineReason}`,
          'OK',
          { duration: 4000 },
        );
        this.simulatingId.set(null);
      });
  }
}
