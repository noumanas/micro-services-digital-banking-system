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
import { Account, Transfer } from '../../core/models/api.models';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { TransferService } from '../../core/services/transfer.service';
import { formatMoney, toMinorUnits } from '../../shared/money.util';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-transfers',
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
  templateUrl: './transfers.component.html',
  styleUrl: './transfers.component.scss',
})
export class TransfersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly transferService = inject(TransferService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly cancelling = signal<string | null>(null);
  readonly accounts = signal<Account[]>([]);
  readonly transfers = signal<Transfer[]>([]);

  readonly formatMoney = formatMoney;

  readonly form = this.fb.nonNullable.group({
    sourceAccountId: ['', Validators.required],
    destinationAccountId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
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
      transfers: this.transferService.list(customerId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ accounts, transfers }) => {
        this.accounts.set(accounts);
        this.transfers.set(transfers.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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

    this.submitting.set(true);
    const { amount, ...rest } = this.form.getRawValue();
    this.transferService
      .create({ ...rest, amount: toMinorUnits(amount) })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe(() => {
        this.snackBar.open('Transfer submitted', 'OK', { duration: 3000 });
        this.form.patchValue({ amount: 0 });
        this.reload();
      });
  }

  cancel(transferId: string): void {
    this.cancelling.set(transferId);
    this.transferService
      .cancel(transferId)
      .pipe(finalize(() => this.cancelling.set(null)))
      .subscribe(() => {
        this.snackBar.open('Transfer cancelled', 'OK', { duration: 3000 });
        this.reload();
      });
  }
}
