import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/** Example prompts the hero field types out to demonstrate the product. */
const DEMOS = [
  'Bright 2-room in Mokotów under 3500 zł with a balcony',
  'Quiet pre-war flat near a park, high ceilings, furnished',
  'New studio by the metro, dishwasher, lift, max 3000 zł',
  'Three rooms in Żoliborz with a terrace and parking',
];

/**
 * The pre-login landing. A full-screen hero states what Seeker is; scrolling
 * reveals the three things it does and the sign-in. The hero's search field
 * auto-types real example prompts — a live demo of the conversational search.
 */
@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome implements OnDestroy {
  protected readonly auth = inject(AuthService);

  protected readonly typed = signal('');
  protected readonly caretOn = signal(true);
  /** Longest demo phrase — reserves the field's footprint so it never resizes. */
  protected readonly longest = DEMOS.reduce((a, b) => (b.length > a.length ? b : a));

  private phrase = 0;
  private char = 0;
  private deleting = false;
  private typeTimer: ReturnType<typeof setTimeout> | undefined;
  private caretTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    const reduced =
      typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.typed.set(DEMOS[0]);
    } else {
      this.tick();
      this.caretTimer = setInterval(() => this.caretOn.update((v) => !v), 530);
    }
  }

  protected signIn(): void {
    void this.auth.signIn();
  }

  private tick(): void {
    const full = DEMOS[this.phrase];
    if (!this.deleting) {
      this.char++;
      this.typed.set(full.slice(0, this.char));
      if (this.char === full.length) {
        this.deleting = true;
        this.typeTimer = setTimeout(() => this.tick(), 1900);
        return;
      }
    } else {
      this.char--;
      this.typed.set(full.slice(0, this.char));
      if (this.char === 0) {
        this.deleting = false;
        this.phrase = (this.phrase + 1) % DEMOS.length;
      }
    }
    this.typeTimer = setTimeout(() => this.tick(), this.deleting ? 28 : 52);
  }

  ngOnDestroy(): void {
    clearTimeout(this.typeTimer);
    clearInterval(this.caretTimer);
  }
}
