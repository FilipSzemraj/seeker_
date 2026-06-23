import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

/**
 * Route guard for premium-only pages (the search workspace). Assumes the user
 * is already authenticated — pair it *after* `authGuard` so an anonymous user
 * is sent to sign-in first. A signed-in user without the `premium` claim is
 * redirected to the gateway page, which explains how to get access.
 */
export const premiumGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.isPremiumUser()) {
        return true;
    }

    return router.parseUrl("/gateway");
};
