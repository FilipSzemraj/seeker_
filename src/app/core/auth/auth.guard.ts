import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";

import { AuthService } from "./auth.service";

/**
 * Route guard for protected pages. If the user is authenticated the route
 * activates; otherwise it kicks off the Cognito sign-in redirect and blocks
 * activation (the browser navigates away to the Hosted UI).
 */
export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);

    if (auth.isAuthenticated()) {
        return true;
    }

    void auth.signIn();
    return false;
};
