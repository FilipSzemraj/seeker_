import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * The post-login gateway. Every signed-in user lands here first; it gates the
 * search workspace on membership in an access tier (see `AuthService.hasAccess`).
 *
 * - Users in an access tier see their tier confirmed and a way into `/app`.
 * - Everyone else is told which groups grant access and to contact an admin.
 *
 * The workspace route itself is protected by `accessGuard`, so this screen is
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

  /** Human-readable label for the resolved tier ("Premium" / "Plus" / "Basic"). */
  protected readonly tierLabel = computed(() => {
    switch (this.auth.accessTier()) {
      case 'premium':
        return 'Premium';
      case 'plus':
        return 'Plus';
      case 'basic':
        return 'Basic';
      default:
        return null;
    }
  });

  protected signOut(): void {
    void this.auth.signOut();
  }
}
