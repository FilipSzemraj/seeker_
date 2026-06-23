import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('flat-searcher');

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // The Cognito callback lands back on the landing page. Once the session is
    // restored, send a freshly-signed-in user straight to the gateway, which
    // decides what they can reach next.
    effect(() => {
      if (this.auth.postLoginPending()) {
        this.auth.consumePostLogin();
        void this.router.navigateByUrl('/gateway');
      }
    });
  }
}
