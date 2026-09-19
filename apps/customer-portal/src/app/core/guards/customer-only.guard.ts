import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Dashboard, profile, transfers, cards, payments, statement, and
// notifications all fetch "my customer profile" data — meaningless (and a
// 404) for a staff session, which has no Customer/KYC record of its own.
// Staff land on Accounts instead, where they manage the tenant's accounts.
export const customerOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isStaff) {
    return router.createUrlTree(['/accounts']);
  }

  return true;
};
