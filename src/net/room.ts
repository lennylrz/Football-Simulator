// Two-player rooms over Supabase: a room row (era, seed, rules, host) and an
// append-only log of actions. Both browsers read the whole log in id order
// and replay it, so they always agree on the game.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Action, RoomManager } from '../game/actions';
import type { GameState } from '../game/game';

const URL = 'https://ehmghfdaagfgzhglrifm.supabase.co';
// The public (anon) key: rooms and actions can only be read and added to.
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobWdoZmRhYWdmZ3poZ2xyaWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MTU1ODYsImV4cCI6MjEwODE5MTU4Nn0.udhlTLwyF07YjNxxQjvO7WwkBBUGi9UljeOT52W84GE';

let client: Promise<SupabaseClient> | null = null;
/** Loaded on first use, so single player never downloads it. */
export function db(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
  return client;
}

export interface Room {
  code: string;
  era: number;
  seed: number;
  rules: NonNullable<GameState['rules']>;
  host: RoomManager & { pid: string };
}

/** The guest joining, or a manager's move. */
export type RoomEntry = ({ t: 'join' } & RoomManager) | Action;

export interface LoggedEntry {
  id: number;
  pid: string;
  action: RoomEntry;
}

/** This browser's id in rooms, kept so a reload rejoins as the same manager. */
export function playerId(): string {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    let id = localStorage.getItem('five-seasons-pid');
    if (!id) {
      id = make();
      localStorage.setItem('five-seasons-pid', id);
    }
    return id;
  } catch {
    return make();
  }
}

// No 0/O or 1/I: codes are read out loud.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

export async function createRoom(era: number, rules: Room['rules'], host: RoomManager): Promise<Room> {
  const sb = await db();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => LETTERS[b % LETTERS.length]).join('');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const room: Room = { code, era, seed, rules, host: { ...host, pid: playerId() } };
    const { error } = await sb.from('rooms').insert(room);
    if (!error) return room;
    if (error.code !== '23505') throw new Error(error.message); // 23505: code taken, try another
  }
  throw new Error('Could not create a room. Try again.');
}

export async function getRoom(code: string): Promise<Room | null> {
  const sb = await db();
  const { data, error } = await sb.from('rooms').select('code, era, seed, rules, host').eq('code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Room | null;
}

/** Fetchers of the rooms being watched, so a move of ours shows up at once. */
const refreshers = new Map<string, () => void>();

export async function sendEntry(code: string, action: RoomEntry): Promise<void> {
  const sb = await db();
  const { error } = await sb.from('room_actions').insert({ room: code, pid: playerId(), action });
  if (error) throw new Error(error.message);
  refreshers.get(code)?.();
}

/**
 * Calls onEntries with every logged entry, in order, as they arrive: the
 * whole log first, then new ones. Realtime pushes trigger a fetch, and a slow
 * poll covers dropped connections. Returns a function that stops watching.
 */
export function watchRoom(code: string, onEntries: (entries: LoggedEntry[]) => void, onError: (e: string) => void): () => void {
  let last = 0;
  let first = true;
  let stopped = false;
  let busy = false;
  let again = false;
  let channel: RealtimeChannel | null = null;
  const fetchNew = async () => {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      const sb = await db();
      do {
        again = false;
        const { data, error } = await sb.from('room_actions').select('id, pid, action').eq('room', code).gt('id', last).order('id').limit(1000);
        if (stopped) return;
        if (error) onError(error.message);
        else if (data.length || first) {
          // The first call comes even for an empty log, so the caller knows it has loaded.
          first = false;
          if (data.length) last = data[data.length - 1].id;
          onEntries(data as LoggedEntry[]);
          if (data.length === 1000) again = true;
        }
      } while (again && !stopped);
    } finally {
      busy = false;
    }
  };
  void db().then((sb) => {
    if (stopped) return;
    channel = sb
      .channel(`room-${code}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room=eq.${code}` }, () => void fetchNew())
      .subscribe();
  });
  void fetchNew();
  const refresh = () => void fetchNew();
  refreshers.set(code, refresh);
  const poll = setInterval(refresh, 4000);
  return () => {
    stopped = true;
    if (refreshers.get(code) === refresh) refreshers.delete(code);
    clearInterval(poll);
    if (channel) void db().then((sb) => sb.removeChannel(channel!));
  };
}

/** Whether this browser has already joined a room as its guest (to rejoin without a new club). */
export async function hasJoined(code: string): Promise<boolean> {
  const sb = await db();
  const { data, error } = await sb.from('room_actions').select('id').eq('room', code).eq('pid', playerId()).eq('action->>t', 'join').limit(1);
  if (error) throw new Error(error.message);
  return data.length > 0;
}
