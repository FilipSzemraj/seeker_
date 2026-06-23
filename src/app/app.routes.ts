import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { premiumGuard } from './core/auth/premium.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./features/welcome/welcome').then((m) => m.Welcome),
    },
    {
        // Post-login landing. Requires a signed-in user; gates `/app` on the
        // `premium` claim and explains how to get access.
        path: 'gateway',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/gateway/gateway').then((m) => m.Gateway),
    },
    {
        // Search workspace — signed in AND premium only.
        path: 'app',
        canActivate: [authGuard, premiumGuard],
        loadComponent: () =>
            import('./features/workspace/workspace').then((m) => m.Workspace),
    },
    {
        path: '**',
        redirectTo: '',
    },
];
