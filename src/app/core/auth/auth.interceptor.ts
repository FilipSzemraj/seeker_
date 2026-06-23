import { inject } from "@angular/core";
import { HttpInterceptorFn } from "@angular/common/http";

import { AuthService } from "./auth.service";
import { isApiRequest } from "../../config/api.config";

/**
 * Attaches the Cognito access token as a Bearer header on outgoing API calls
 * so API Gateway's JWT authorizer can validate the request. Only requests to
 * our backend API origin (`API_BASE_URL`) are decorated, so the token is never
 * leaked to third parties. The site (GitHub Pages) and the API are different
 * origins, so this is a cross-origin request guarded by API Gateway CORS.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = inject(AuthService).accessToken();

    if (!token || !isApiRequest(req.url)) {
        return next(req);
    }

    return next(
        req.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
        }),
    );
};
