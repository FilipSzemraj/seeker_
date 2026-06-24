import {
    UserManager,
    WebStorageStateStore,
    type UserManagerSettings,
} from "oidc-client-ts";

/**
 * Absolute URL the app is served from, including any sub-path (e.g.
 * `https://you.github.io/flat-searcher/` on GitHub Pages, or
 * `http://localhost:4200/` in dev). Derived from the `<base href>` Angular
 * uses for routing, so the callback lands on a path that actually serves the
 * SPA rather than the origin root. Register this exact string (trailing slash
 * included) as an allowed callback / sign-out URL on the Cognito App Client.
 */
const appBaseUri = globalThis.document.baseURI;

/**
 * AWS Cognito (OIDC) configuration for the Flat Searcher SPA.
 *
 * `redirect_uri` / `post_logout_redirect_uri` are derived from the app base URI
 * so the same build works on CloudFront, GitHub Pages (sub-path) and on
 * `http://localhost:4200/` during development. Each base URI you use must be
 * registered as an allowed callback / sign-out URL on the Cognito App Client.
 */
const cognitoAuthConfig: UserManagerSettings = {
    authority:
        "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_KG8bq07ux",
    client_id: "676n9ac2b3tcoel2ik1v5hnep8",
    redirect_uri: appBaseUri,
    post_logout_redirect_uri: appBaseUri,
    response_type: "code",
    // Cognito always returns a refresh token with the authorization-code grant
    // — it does NOT use the OIDC `offline_access` scope (and rejects it with
    // `invalid_scope` unless it's explicitly allowed on the App Client). So we
    // keep the standard scopes here; the refresh token is what keeps the
    // session alive (App Client "Refresh token expiration" governs its life).
    scope: "email openid",
    // Persist tokens across full page reloads (PKCE, no client secret in the browser).
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    // Keep the session alive transparently using the refresh token while a tab
    // is open. Note: this does NOT cover an already-expired token on cold load
    // (authts/oidc-client-ts#2012) — AuthService.restoreSession handles that.
    automaticSilentRenew: true,
    // Drop the `?code=&state=` params from the URL after the callback completes.
    response_mode: "query",
};

/**
 * Cognito Hosted UI details used for the federated sign-out redirect.
 * `domain` comes from the Cognito User Pool "App integration" tab (or CDK
 * output) — e.g. `https://flat-searcher.auth.eu-central-1.amazoncognito.com`.
 */
export const cognitoHostedUi = {
    domain: "https://eu-central-1kg8bq07ux.auth.eu-central-1.amazoncognito.com",
    clientId: cognitoAuthConfig.client_id,
    logoutUri: appBaseUri,
};

/** Single shared UserManager instance for the whole app. */
export const userManager = new UserManager(cognitoAuthConfig);

/**
 * Redirects the browser to the Cognito Hosted UI logout endpoint, which clears
 * the Cognito session cookie before returning the user to `logout_uri`.
 */
export function signOutRedirect(): void {
    const { domain, clientId, logoutUri } = cognitoHostedUi;
    window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
        logoutUri,
    )}`;
}
