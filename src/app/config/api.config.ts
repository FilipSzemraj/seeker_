import { environment } from '../../environments/environment';

/**
 * Base URL of the backend HTTP API (API Gateway `execute-api` URL, or a custom
 * domain in front of it). Because the site is hosted on GitHub Pages and the
 * API lives on a different origin, the frontend must call the API by its
 * absolute URL — there is no same-origin `/api/*` proxy as there would be
 * behind CloudFront.
 *
 * The value is environment-driven: `environment.ts` defaults it to
 * `http://localhost:8000` for local dev; the production build swaps in
 * `environment.prod.ts` (set the deployed URL there). No trailing slash.
 */
export const API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');

/** True when the request targets our backend API (and should carry the JWT). */
export function isApiRequest(url: string): boolean {
  return url.startsWith(API_BASE_URL);
}
