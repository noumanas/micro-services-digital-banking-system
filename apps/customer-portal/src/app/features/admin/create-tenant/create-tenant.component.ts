import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Tenant } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-create-tenant',
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
  ],
  templateUrl: './create-tenant.component.html',
  styleUrl: './create-tenant.component.scss',
})
export class CreateTenantComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly snackBar = inject(MatSnackBar);

  readonly creating = signal(false);
  readonly created = signal<Tenant | null>(null);
  readonly loadingTenants = signal(true);
  readonly tenants = signal<Tenant[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    this.reloadTenants();
  }

  private reloadTenants(): void {
    this.loadingTenants.set(true);
    this.tenantService
      .list()
      .pipe(finalize(() => this.loadingTenants.set(false)))
      .subscribe((tenants) => this.tenants.set(tenants));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name } = this.form.getRawValue();
    this.creating.set(true);
    this.auth
      .createTenant(name)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe((tenant) => {
        this.created.set({ ...tenant, createdAt: new Date().toISOString() });
        this.form.reset();
        this.snackBar.open(`Tenant "${tenant.name}" created`, 'OK', { duration: 3000 });
        this.reloadTenants();
      });
  }

  copyId(id: string): void {
    navigator.clipboard?.writeText(id);
    this.snackBar.open('Tenant ID copied', 'OK', { duration: 2000 });
  }
}
