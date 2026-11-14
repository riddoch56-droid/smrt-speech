import { create } from 'zustand';
import type { ActivityId, SessionRecord, SessionSettings } from './types';

export interface SessionRequest {
  activity: ActivityId;
  settings: SessionSettings;
  /** A patient id, or "guest" for practice without saving. */
  patientId: string;
  /** Restrict the session to these items (Practise missed items). */
  itemIds?: string[];
  /** Changes on every start so the session screen remounts. */
  nonce: number;
}

export interface SessionResult {
  record: SessionRecord;
  /** False in guest mode: nothing was stored. */
  saved: boolean;
  /** False for free practice with scoring off. */
  scored: boolean;
  request: SessionRequest;
}

interface SessionStore {
  request: SessionRequest | null;
  result: SessionResult | null;
  /** True while a session is running, so updates never interrupt it. */
  running: boolean;
  start(req: Omit<SessionRequest, 'nonce'>): void;
  finish(result: SessionResult): void;
  abandon(): void;
  clearResult(): void;
}

export const useSession = create<SessionStore>((set) => ({
  request: null,
  result: null,
  running: false,
  start: (req) => set({ request: { ...req, nonce: Date.now() }, result: null, running: true }),
  finish: (result) => set({ result, request: null, running: false }),
  abandon: () => set({ request: null, running: false }),
  clearResult: () => set({ result: null }),
}));
