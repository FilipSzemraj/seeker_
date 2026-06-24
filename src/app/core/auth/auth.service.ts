import { Injectable, computed, effect, signal } from "@angular/core";
import type { User } from "oidc-client-ts";

import { signOutRedirect, userManager } from "../../config/oidc-client.config";

/**
 * Central source of truth for authentication state.
 *
 * Wraps the oidc-client-ts `UserManager` and exposes the logged-in user as
 * signals so components, guards and interceptors can read identity/tokens
 * reactively. Inject this anywhere you need the current user or a token.
 */
@Injectable({ providedIn: "root" })
export class AuthService {
    private readonly currentUser = signal<User | null>(null);

    /** The raw OIDC user (tokens + profile), or null when signed out. */
    readonly user = this.currentUser.asReadonly();

    /**
     * Raised once when a Cognito redirect callback has just completed, so the
     * app can route the freshly-signed-in user to the gateway page instead of
     * leaving them on the landing screen. Read it via `postLoginPending` and
     * clear it with `consumePostLogin()` after handling the redirect.
     */
    private readonly _postLoginPending = signal(false);
    readonly postLoginPending = this._postLoginPending.asReadonly();

    /**
     * True once the access token has expired and the silent refresh could not
     * renew it (e.g. the refresh token is gone or revoked). The app surfaces a
     * blocking dialog while this holds, asking the user to sign in again or
     * return home — we never force an interactive redirect from the background.
     */
    private readonly _sessionExpired = signal(false);
    readonly sessionExpired = this._sessionExpired.asReadonly();

    /** True when there is a non-expired user session. */
    readonly isAuthenticated = computed(() => {
        const user = this.currentUser();
        return user !== null && !user.expired;
    });

    /** Convenience accessors for the most-used profile/token fields. */
    readonly email = computed(() => this.currentUser()?.profile?.email ?? null);
    readonly accessToken = computed(
        () => this.currentUser()?.access_token ?? null,
    );
    readonly idToken = computed(() => this.currentUser()?.id_token ?? null);
    readonly refreshToken = computed(
        () => this.currentUser()?.refresh_token ?? null,
    );

    readonly groups = computed(() => {
        return this.currentUser()?.profile?.["cognito:groups"] as string[] | undefined;
    });

    readonly isPremiumUser = computed(() => {
        return this.groups()?.includes("premium") ?? false;
    });

    constructor() {
        // Keep the signal in sync with UserManager lifecycle events.
        userManager.events.addUserLoaded((user) =>
            this.currentUser.set(user),
        );
        userManager.events.addUserUnloaded(() => this.currentUser.set(null));
        userManager.events.addSilentRenewError((error) =>
            console.error("[auth] silent renew failed", error),
        );
        userManager.events.addAccessTokenExpired(() => {
            // This only fires when the silent refresh failed to renew the token
            // (no/expired refresh token). Drop the dead session and let the app
            // show the blocking sign-in dialog instead of yanking the user to
            // the Hosted UI from whatever page they were on.
            void userManager.removeUser();
            this.currentUser.set(null);
            this._sessionExpired.set(true);
        });
        effect(() => {
                if (this.isAuthenticated()) {
                    console.log("[auth] user signed in", this.email(), this.groups(), this.isPremiumUser());
                } else {
                    console.log("[auth] user signed out");
                }
            }
        )
    }

    /**
     * Called once at startup (see `provideAppInitializer`). Completes the
     * Cognito redirect when we land on the callback, otherwise restores any
     * previously stored session.
     */
    async restoreSession(): Promise<void> {
        if (this.isRedirectCallback()) {
            try {
                const user = await userManager.signinCallback();
                this.currentUser.set(user ?? null);
                if (user && !user.expired) {
                    // Tell the app to send this just-signed-in user to /gateway.
                    this._postLoginPending.set(true);
                }
            } catch (error) {
                console.error("[auth] sign-in callback failed", error);
            } finally {
                // Strip `?code=&state=` so a refresh doesn't re-trigger the callback.
                history.replaceState(
                    {},
                    document.title,
                    window.location.pathname,
                );
            }
            return;
        }

        const user = await userManager.getUser();
        if (user && !user.expired) {
            this.currentUser.set(user);
            return;
        }

        // The stored access token is expired. Cognito hands us a refresh token
        // even without `offline_access`, but oidc-client-ts won't auto-renew a
        // token that's already expired on load (authts/oidc-client-ts#2012), so
        // do it ourselves. `signinSilent` uses the refresh token directly — no
        // iframe, no `silent_redirect_uri`. If the refresh token is gone or
        // expired (past the App Client's refresh-token lifetime) this throws and
        // we treat the user as signed out.
        if (user?.refresh_token) {
            try {
                const renewed = await userManager.signinSilent();
                this.currentUser.set(
                    renewed && !renewed.expired ? renewed : null,
                );
                return;
            } catch (error) {
                console.warn("[auth] silent token refresh on load failed", error);
            }
        }

        this.currentUser.set(null);
    }

    /** Clear the post-login redirect flag once the app has acted on it. */
    consumePostLogin(): void {
        this._postLoginPending.set(false);
    }

    /** Dismiss the session-expired dialog (e.g. when the user heads home). */
    clearSessionExpired(): void {
        this._sessionExpired.set(false);
    }

    /** Begin the Cognito Hosted UI authorization-code (PKCE) flow. */
    signIn(): Promise<void> {
        return userManager.signinRedirect();
    }

    /** Clear local tokens and redirect to the Cognito logout endpoint. */
    async signOut(): Promise<void> {
        await userManager.removeUser();
        this.currentUser.set(null);
        signOutRedirect();
    }

    private isRedirectCallback(): boolean {
        const params = new URLSearchParams(window.location.search);
        // Both success (`code`) and error (`error`) responses carry `state`.
        return params.has("state") && (params.has("code") || params.has("error"));
    }
}
