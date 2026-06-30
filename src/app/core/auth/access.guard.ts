import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

/**
 * Route guard for the search workspace. Assumes the user is already
 * authenticated — pair it *after* `authGuard` so an anonymous user is sent to
 * sign-in first. A signed-in user with no access-tier group (`seeker-basic` /
 * `seeker-plus` / `seeker-premium`) is redirected to the gateway, which
 * explains the requirement. This mirrors the API's 403 access check exactly.
 */
export const accessGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasAccess()) {
        return true;
    }

    return router.parseUrl("/gateway");
};
