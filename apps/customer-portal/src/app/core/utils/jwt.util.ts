import { AccessTokenPayload } from '../models/api.models';

/** Decodes a JWT's payload without verifying the signature — the browser
 * never needs to verify it, only read the claims it was handed. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: AccessTokenPayload | null, skewSeconds = 10): boolean {
  if (!payload) return true;
  return Date.now() / 1000 >= payload.exp - skewSeconds;
}
