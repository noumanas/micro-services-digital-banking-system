import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { Customer, KycVerification } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { KycService } from '../../core/services/kyc.service';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    StatusChipComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly kycService = inject(KycService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submittingKyc = signal(false);
  readonly customer = signal<Customer | null>(null);
  readonly verifications = signal<KycVerification[]>([]);
  readonly kycSimulate = signal<'approve' | 'reject'>('approve');

  readonly form = this.fb.nonNullable.group({
    firstName: [''],
    lastName: [''],
    phone: [''],
  });

  get canSubmitKyc(): boolean {
    const status = this.customer()?.kycStatus;
    return status === 'PENDING' || status === 'REJECTED';
  }

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    this.loading.set(true);
    this.customerService.get(customerId).subscribe((customer) => {
      this.customer.set(customer);
      this.form.patchValue({
        firstName: customer.firstName ?? '',
        lastName: customer.lastName ?? '',
        phone: customer.phone ?? '',
      });
      this.loading.set(false);
    });

    this.kycService.list(customerId).subscribe((verifications) => this.verifications.set(verifications));
  }

  save(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    this.saving.set(true);
    this.customerService
      .update(customerId, this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((customer) => {
        this.customer.set(customer);
        this.snackBar.open('Profile updated', 'OK', { duration: 3000 });
      });
  }

  submitKyc(): void {
    const customerId = this.auth.customerId;
    if (!customerId) return;

    this.submittingKyc.set(true);
    this.kycService
      .submit(customerId, this.kycSimulate())
      .pipe(finalize(() => this.submittingKyc.set(false)))
      .subscribe(() => {
        this.snackBar.open('KYC verification submitted', 'OK', { duration: 3000 });
        this.reload();
      });
  }
}
