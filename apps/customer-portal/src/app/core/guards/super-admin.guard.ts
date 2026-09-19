import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Platform administration (tenant list/users/creation) is SUPER_ADMIN-only —
// gated client-side for navigation UX; the API enforces it independently via
// the `tenant:read` permission.
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasPermission('tenant:read')) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
