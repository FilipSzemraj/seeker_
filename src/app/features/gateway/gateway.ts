import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * The post-login gateway. Every signed-in user lands here first; it gates the
 * search workspace on the `premium` claim (see `AuthService.isPremiumUser`).
 *
 * - Premium users see their access confirmed and a way into `/app`.
 * - Everyone else is told to contact an administrator and sent back home.
 *
 * The workspace route itself is protected by `premiumGuard`, so this screen is
 * the explanation, not the enforcement.
 */
@Component({
  selector: 'app-gateway',
  imports: [RouterLink],
  templateUrl: './gateway.html',
  styleUrl: './gateway.scss',
})
export class Gateway {
  protected readonly auth = inject(AuthService);

  protected signOut(): void {
    void this.auth.signOut();
  }
}
