/**
 * Development environment. The dev build (default `ng build` / `ng serve`)
 * uses this file; the production build swaps in `environment.prod.ts` via the
 * `fileReplacements` entry in angular.json.
 *
 * `apiBaseUrl` points at a locally-run backend (`uv run uvicorn
 * seeker.api.app:app --port 8000`, ideally with `SEEKER_API_AUTH_DISABLED=1`).
 */
export const environment = {
  production: false,
  //apiBaseUrl: "https://nwzibqhzb8.execute-api.eu-central-1.amazonaws.com"
  apiBaseUrl: 'http://localhost:8000',
};
 