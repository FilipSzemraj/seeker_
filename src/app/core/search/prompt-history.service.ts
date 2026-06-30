import { Injectable, computed, signal } from '@angular/core';

/** localStorage key for the persisted semantic-search prompt history. */
const HISTORY_KEY = 'seeker.promptHistory.v1';
/** How many prompts to retain (the search bar surfaces the most recent few). */
const CAP = 10;
/** How many to show as quick re-run chips. */
const RECENT_COUNT = 3;

/**
 * Remembers the user's recent semantic-search prompts across sessions
 * (localStorage). Retrieval mode surfaces the most recent {@link RECENT_COUNT}
 * as one-tap chips so a prior search can be re-run without retyping. Most-recent
 * first; re-submitting an existing prompt moves it back to the front.
 */
@Injectable({ providedIn: 'root' })
export class PromptHistoryService {
  /** Full retained history, newest first. */
  readonly history = signal<string[]>(this.read());
  /** The most recent prompts shown as quick chips. */
  readonly recent = computed(() => this.history().slice(0, RECENT_COUNT));

  /** Record a freshly-run prompt (de-duplicated, capped, persisted). */
  add(prompt: string): void {
    const p = prompt.trim();
    if (!p) return;
    const next = [p, ...this.history().filter((x) => x !== p)].slice(0, CAP);
    this.history.set(next);
    this.write(next);
  }

  /** Forget a single prompt (chip dismiss). */
  remove(prompt: string): void {
    const next = this.history().filter((x) => x !== prompt);
    this.history.set(next);
    this.write(next);
  }

  private read(): string[] {
    try {
      const raw = globalThis.localStorage?.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private write(value: string[]): void {
    try {
      globalThis.localStorage?.setItem(HISTORY_KEY, JSON.stringify(value));
    } catch {
      // localStorage may be unavailable (private mode / quota) — memory still holds.
    }
  }
}
