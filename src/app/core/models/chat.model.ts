/**
 * Conversational (RAG) chat shapes for `POST /api/chat`.
 *
 * The planned Lambda embeds the prompt, runs a vector search, fetches the
 * matching Mongo docs, calls Anthropic, and returns a grounded answer plus the
 * referenced listings as "sources" (full Listing models, eventually carrying a
 * canonical URL in their metadata). The frontend renders that answer as prose
 * with the referenced listings shown inline as compact cards.
 */

import type { Listing } from './listing.model';

/** A listing the assistant cited, with why it matched (from the RAG chunk). */
export interface ListingMatch {
  listing: Listing;
  /** Short, grounded reason this listing answers the prompt. */
  reason?: string;
  /** Vector similarity score, if surfaced. */
  score?: number;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Present on assistant turns that grounded their answer in listings. */
  matches?: ListingMatch[];
  /** Set while an assistant turn is still streaming/pending. */
  pending?: boolean;
}

/** Response body of POST /api/chat. */
export interface ChatResponse {
  answer: string;
  sources: ListingMatch[];
}
