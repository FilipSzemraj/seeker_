/**
 * Base URL of the backend HTTP API (API Gateway `execute-api` URL, or a custom
 * domain in front of it). Because the site is hosted on GitHub Pages and the
 * API lives on a different origin, the frontend must call the API by its
 * absolute URL — there is no same-origin `/api/*` proxy as there would be
 * behind CloudFront.
 *
 * Fill this from the CDK stack output after the first backend deploy. No
 * trailing slash.
 */
export const API_BASE_URL = "https://REPLACE_ME.execute-api.eu-central-1.amazonaws.com";

/** True when the request targets our backend API (and should carry the JWT). */
export function isApiRequest(url: string): boolean {
    return url.startsWith(API_BASE_URL);
}
