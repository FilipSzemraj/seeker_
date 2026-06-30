import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { accessGuard } from './core/auth/access.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./features/welcome/welcome').then((m) => m.Welcome),
    },
    {
        // Post-login landing. Requires a signed-in user; explains the access
        // tier the workspace needs and reflects the user's current tier.
        path: 'gateway',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/gateway/gateway').then((m) => m.Gateway),
    },
    {
        // Search workspace — signed in AND in an access tier (basic/plus/premium).
        path: 'app',
        canActivate: [authGuard, accessGuard],
        loadComponent: () =>
            import('./features/workspace/workspace').then((m) => m.Workspace),
    },
    {
        path: '**',
        redirectTo: '',
    },
];
