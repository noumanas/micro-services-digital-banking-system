import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, forkJoin } from 'rxjs';
import { Account, Payment, PaymentDirection } from '../../core/models/api.models';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { formatMoney, toMinorUnits } from '../../shared/money.util';
import { StatusChipComponent } from '../../shared/status-chip.component';

const DIRECTIONS: PaymentDirection[] = ['INBOUND', 'OUTBOUND'];

@Component({
  selector: 'app-payments',
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
    MatRadioModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
  ],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class PaymentsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly paymentService = inject(PaymentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly directions = DIRECTIONS;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly reversing = signal<string | null>(null);
  readonly accounts = signal<Account[]>([]);
  readonly payments = signal<Payment[]>([]);

  readonly formatMoney = formatMoney;

  readonly form = this.fb.nonNullable.group({
    accountId: ['', Validators.required],
    direction: this.fb.nonNullable.control<PaymentDirection>('INBOUND', [Validators.required]),
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
    externalReference: [''],
    simulate: this.fb.nonNullable.control<'approve' | 'decline'>('approve'),
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
      payments: this.paymentService.list(customerId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ accounts, payments }) => {
        this.accounts.set(accounts);
        this.payments.set(payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      });
  }

  accountLabel(accountId: string): string {
    const account = this.accounts().find((a) => a.id === accountId);
    return account ? `${account.type} · ${account.currency} · ${account.id.slice(0, 8)}` : accountId;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { externalReference, amount, ...rest } = this.form.getRawValue();
    this.submitting.set(true);
    this.paymentService
      .create({ ...rest, amount: toMinorUnits(amount), externalReference: externalReference || undefined })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe(() => {
        this.snackBar.open('Payment submitted', 'OK', { duration: 3000 });
        this.form.patchValue({ amount: 0, externalReference: '' });
        this.reload();
      });
  }

  reverse(payment: Payment): void {
    this.reversing.set(payment.id);
    this.paymentService
      .reverse(payment.id)
      .pipe(finalize(() => this.reversing.set(null)))
      .subscribe(() => {
        this.snackBar.open('Payment reversed', 'OK', { duration: 3000 });
        this.reload();
      });
  }
}
