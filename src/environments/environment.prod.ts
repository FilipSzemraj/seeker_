/**
 * Production environment. Swapped in for `environment.ts` at build time by the
 * `fileReplacements` entry in angular.json (configuration `production`).
 *
 * `apiBaseUrl` is the API Gateway `execute-api` URL (or a custom domain in
 * front of it) — fill it from the SAM/CDK stack output after the first backend
 * deploy. No trailing slash.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://REPLACE_ME.execute-api.eu-central-1.amazonaws.com',
};
