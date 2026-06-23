import { Component, effect, ElementRef, input, output, signal, viewChild } from '@angular/core';

import type { ChatMessage } from '../../../../core/models/chat.model';
import { ListingCard } from '../listing-card/listing-card';

/**
 * Foldable conversation with the RAG agent. Collapses to a launcher pill so it
 * never competes with the results list. Assistant turns render grounded prose
 * plus the cited listings inline, using the same card as the results grid.
 */
@Component({
  selector: 'app-chat-panel',
  imports: [ListingCard],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
})
export class ChatPanel {
  readonly open = input(false);
  readonly busy = input(false);
  readonly messages = input<ChatMessage[]>([]);

  readonly ask = output<string>();
  readonly toggle = output<void>();
  readonly clear = output<void>();

  protected readonly draft = signal('');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    effect(() => {
      // Re-run whenever the thread or pending state changes, then stick to bottom.
      this.messages();
      this.busy();
      this.open();
      const el = this.scroller()?.nativeElement;
      if (el) setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 0);
    });
  }

  protected submit(): void {
    const value = this.draft().trim();
    if (!value || this.busy()) return;
    this.ask.emit(value);
    this.draft.set('');
  }
}
