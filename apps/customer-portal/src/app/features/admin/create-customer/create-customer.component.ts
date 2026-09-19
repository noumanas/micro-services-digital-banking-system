import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { RegisterResponse, Tenant, TenantUser } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { StatusChipComponent } from '../../../shared/status-chip.component';

function passwordsMatch(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  };
}

@Component({
  selector: 'app-create-customer',
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
  templateUrl: './create-customer.component.html',
  styleUrl: './create-customer.component.scss',
})
export class CreateCustomerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly snackBar = inject(MatSnackBar);

  readonly creating = signal(false);
  readonly created = signal<RegisterResponse | null>(null);
  readonly hidePassword = signal(true);
  readonly loadingTenants = signal(true);
  readonly tenants = signal<Tenant[]>([]);
  readonly loadingUsers = signal(false);
  readonly tenantUsers = signal<TenantUser[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      tenantId: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch() },
  );

  ngOnInit(): void {
    this.loadingTenants.set(true);
    this.tenantService
      .list()
      .pipe(finalize(() => this.loadingTenants.set(false)))
      .subscribe((tenants) => {
        this.tenants.set(tenants);
        const prefill = this.route.snapshot.queryParamMap.get('tenantId');
        if (prefill && tenants.some((t) => t.id === prefill)) {
          this.form.patchValue({ tenantId: prefill });
          this.loadTenantUsers(prefill);
        }
      });
  }

  onTenantChange(tenantId: string): void {
    this.created.set(null);
    this.loadTenantUsers(tenantId);
  }

  private loadTenantUsers(tenantId: string): void {
    this.loadingUsers.set(true);
    this.tenantService
      .listUsers(tenantId)
      .pipe(finalize(() => this.loadingUsers.set(false)))
      .subscribe((users) => this.tenantUsers.set(users));
  }

  tenantName(tenantId: string): string {
    return this.tenants().find((t) => t.id === tenantId)?.name ?? tenantId;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { tenantId, email, password } = this.form.getRawValue();
    this.creating.set(true);
    this.auth
      .register(tenantId, email, password)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe((customer) => {
        this.created.set(customer);
        this.form.patchValue({ email: '', password: '', confirmPassword: '' });
        this.form.markAsPristine();
        this.form.markAsUntouched();
        this.snackBar.open(`Customer ${customer.email} created`, 'OK', { duration: 3000 });
        this.loadTenantUsers(tenantId);
      });
  }
}
