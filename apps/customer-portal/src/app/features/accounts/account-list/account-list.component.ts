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
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Account, AccountType } from '../../../core/models/api.models';
import { AccountService } from '../../../core/services/account.service';
import { AuthService } from '../../../core/services/auth.service';
import { StatusChipComponent } from '../../../shared/status-chip.component';

const ACCOUNT_TYPES: AccountType[] = ['CURRENT', 'SAVINGS', 'BUSINESS', 'WALLET'];

@Component({
  selector: 'app-account-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
  ],
  templateUrl: './account-list.component.html',
  styleUrl: './account-list.component.scss',
})
export class AccountListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly snackBar = inject(MatSnackBar);

  readonly accountTypes = ACCOUNT_TYPES;
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly accounts = signal<Account[]>([]);
  readonly isStaff = this.auth.isStaff;

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<AccountType>('CURRENT', [Validators.required]),
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
  });

  readonly filterForm = this.fb.nonNullable.group({
    customerId: [''],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);

    if (this.isStaff) {
      const filter = this.filterForm.getRawValue().customerId.trim() || undefined;
      this.accountService.list(filter).subscribe((accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
      });
      return;
    }

    const customerId = this.auth.customerId;
    if (!customerId) return;
    this.accountService.list(customerId).subscribe((accounts) => {
      this.accounts.set(accounts);
      this.loading.set(false);
    });
  }

  createAccount(): void {
    const customerId = this.auth.customerId;
    if (!customerId || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { type, currency } = this.form.getRawValue();
    this.creating.set(true);
    this.accountService
      .create(customerId, type, currency)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe(() => {
        this.snackBar.open('Account created', 'OK', { duration: 3000 });
        this.reload();
      });
  }
}
