import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Module-scoped so a single in-flight refresh is shared across every request
// that races into a 401 at the same time — the interceptor itself is a
// singleton for the app's lifetime, so this is safe.
let refreshInFlight = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

/** On 401: refreshes the access token once and retries every request that
 * failed while the refresh was in flight. On any other error: surfaces the
 * backend's message (and correlationId, for support/debugging) as a toast. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const isAuthCall = req.url.includes('/v1/auth/');

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      if (err.status === 401 && !isAuthCall && auth.refreshTokenValue) {
        if (!refreshInFlight) {
          refreshInFlight = true;
          refreshedToken$.next(null);

          return auth.refreshAccessToken().pipe(
            switchMap((tokens) => {
              refreshInFlight = false;
              refreshedToken$.next(tokens.accessToken);
              return next(req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } }));
            }),
            catchError((refreshErr) => {
              refreshInFlight = false;
              auth.logout();
              router.navigate(['/login']);
              return throwError(() => refreshErr);
            }),
          );
        }

        return refreshedToken$.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        );
      }

      if (err.status === 401 && !isAuthCall) {
        auth.logout();
        router.navigate(['/login']);
      }

      const body = err.error as { message?: string; correlationId?: string } | undefined;
      const message = body?.message ?? err.message ?? 'Something went wrong';
      snackBar.open(message, 'Dismiss', { duration: 5000 });
      if (body?.correlationId) {
        // eslint-disable-next-line no-console
        console.error(`[${body.correlationId}] ${message}`);
      }

      return throwError(() => err);
    }),
  );
};
