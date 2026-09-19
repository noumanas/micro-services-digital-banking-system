import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

function passwordsMatch(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: '../auth.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly submitting = signal(false);
  readonly creatingTenant = signal(false);
  readonly showTenantHelper = signal(false);
  readonly hidePassword = signal(true);

  readonly bankNameControl = this.fb.nonNullable.control('', [Validators.required]);

  readonly form = this.fb.nonNullable.group(
    {
      tenantId: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch() },
  );

  createTenant(): void {
    if (this.bankNameControl.invalid) {
      this.bankNameControl.markAsTouched();
      return;
    }

    this.creatingTenant.set(true);
    this.auth
      .createTenant(this.bankNameControl.value)
      .pipe(finalize(() => this.creatingTenant.set(false)))
      .subscribe((tenant) => {
        this.form.patchValue({ tenantId: tenant.id });
        this.snackBar.open(`Created tenant "${tenant.name}" — id filled in below`, 'OK', { duration: 4000 });
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { tenantId, email, password } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth
      .register(tenantId, email, password)
      .pipe(
        switchMap(() => this.auth.login(email, password)),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe(() => {
        this.snackBar.open('Account created — welcome!', 'OK', { duration: 3000 });
        this.router.navigateByUrl('/dashboard');
      });
  }
}
