// Transfer offers shown to the user, and bids for players the user sells.
import { capacity } from './clubs';
import type { GameData } from './data';
import {
  EXTERNAL, type GameState, MAX_SQUAD, MIN_SQUAD, marketPool, type PlayerState, transfer,
} from './game';
import { type Rng, normal, stream, weightedIndex } from './rng';
import { roundFee } from './valuation';

export type OfferTier = 'ordinary' | 'exciting' | 'star';

export interface Offer {
  player: number;
  fee: number;
  tier: OfferTier;
  status: 'open' | 'bought' | 'gone';
  /** club that signed the player instead */
  goneTo?: number;
}

export const OFFERS_PER_WINDOW = 5;

/** Asking price: market value with some variation, usually a small premium. */
export function askingPrice(value: number, rng: Rng): number {
  return roundFee(value * Math.exp(normal(rng, 0.08, 0.15)));
}

/**
 * Offers are drawn from the pool around what the club's reputation can
 * attract: mostly ordinary players, sometimes exciting ones, and very rarely
 * a star well above the club's level.
 */
export function generateOffers(state: GameState, data: GameData): Offer[] {
  const rng = stream(state.seed, 'offers', state.season);
  const club = state.clubs[state.user];
  const cap = capacity(club.rep);
  const pool = marketPool(state, data).filter((p) => p.age <= 33);
  const taken = new Set<number>();
  const offers: Offer[] = [];
  const draw = (tier: OfferTier): PlayerState | undefined => {
    let weight: (p: PlayerState) => number;
    if (tier === 'star') {
      const floor = Math.max(cap + 4, 83);
      weight = (p) => (p.ovr >= floor ? 1 : 0);
    } else if (tier === 'exciting') {
      weight = (p) =>
        (p.ovr >= cap - 1 && p.ovr <= cap + 3) || (p.age <= 21 && p.pot >= cap + 6 && p.ovr >= cap - 10) ? 1 : 0;
    } else {
      weight = (p) => (p.ovr >= cap - 12 && p.ovr <= cap - 2 ? Math.exp(-((p.ovr - (cap - 6)) ** 2) / 18) : 0);
    }
    const cands = pool.filter((p) => !taken.has(p.id));
    const w = cands.map(weight);
    if (!w.some((x) => x > 0)) return undefined;
    return cands[weightedIndex(rng, w)];
  };
  while (offers.length < OFFERS_PER_WINDOW) {
    const r = rng();
    const tier: OfferTier = r < 0.03 ? 'star' : r < 0.2 ? 'exciting' : 'ordinary';
    const p = draw(tier) ?? draw('ordinary');
    if (!p) break;
    taken.add(p.id);
    offers.push({ player: p.id, fee: askingPrice(p.value, rng), tier, status: 'open' });
  }
  return offers;
}

export function buyOffer(state: GameState, data: GameData, index: number): string | null {
  const o = state.offers[index];
  const club = state.clubs[state.user];
  if (!o || o.status !== 'open') return 'This player is no longer available.';
  if (club.squad.length >= MAX_SQUAD) return `Your squad is full (${MAX_SQUAD}). Sell someone first.`;
  if (club.cash < o.fee) return 'Not enough budget.';
  transfer(state, data, o.player, state.user, o.fee);
  o.status = 'bought';
  return null;
}

export interface Bid {
  /** club index, or EXTERNAL */
  club: number;
  name: string;
  fee: number;
}

/** Bids for one of the user's players: AI clubs that could use him, and a club abroad. */
export function bidsFor(state: GameState, data: GameData, player: number): Bid[] {
  const p = state.players[player];
  const rng = stream(state.seed, 'bids', state.season, state.windowPhase, player);
  const bid = () => roundFee(p.value * Math.exp(normal(rng, 0, 0.12)));
  const bids: Bid[] = [];
  const interested = state.clubs.filter((c) => {
    if (c.id === state.user || c.squad.length >= MAX_SQUAD) return false;
    if (p.ovr > capacity(c.rep) + 2 || c.cash < p.value * 1.1) return false;
    const xi = c.xi.map((id) => state.players[id]?.ovr ?? 0);
    const avg = xi.reduce((s, x) => s + x, 0) / Math.max(1, xi.length);
    return p.ovr >= avg - 3;
  });
  for (let k = 0; k < 2 && interested.length; k++) {
    const c = interested.splice(Math.floor(rng() * interested.length), 1)[0];
    bids.push({ club: c.id, name: data.meta.gameClubs[c.id], fee: bid() });
  }
  // A club from outside the league: one where players of his level play.
  const peers = marketPool(state, data).filter((q) => Math.abs(q.ovr - p.ovr) <= 2);
  const names = peers
    .map((q) => data.meta.clubNames[data.seasons[state.season][q.id]?.[6] ?? 0])
    .filter((n) => n !== 'Free agent');
  if (names.length) bids.push({ club: EXTERNAL, name: names[Math.floor(rng() * names.length)], fee: bid() });
  return bids.sort((a, b) => b.fee - a.fee);
}

export function canSell(state: GameState): boolean {
  return state.clubs[state.user].squad.length > MIN_SQUAD;
}

export function acceptBid(state: GameState, data: GameData, player: number, bid: Bid): string | null {
  if (!canSell(state)) return `You need at least ${MIN_SQUAD} players.`;
  if (bid.club !== EXTERNAL) {
    const buyer = state.clubs[bid.club];
    if (buyer.cash < bid.fee || buyer.squad.length >= MAX_SQUAD) return 'That club has pulled out.';
  }
  transfer(state, data, player, bid.club, bid.fee, bid.name);
  return null;
}

/** Releases a player on a free transfer. */
export function releasePlayer(state: GameState, data: GameData, player: number): string | null {
  if (!canSell(state)) return `You need at least ${MIN_SQUAD} players.`;
  transfer(state, data, player, EXTERNAL, 0, 'Released');
  return null;
}

/** Total effective strength of a squad's best XI, for quick comparisons. */
export function squadRating(state: GameState, club: number): number {
  const xi = state.clubs[club].xi.map((id) => state.players[id]?.ovr ?? 0);
  return xi.reduce((s, x) => s + x, 0) / Math.max(1, xi.length);
}

