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

export interface IncomingBid {
  player: number;
  /** club index, or EXTERNAL */
  club: number;
  name: string;
  fee: number;
  status: 'open' | 'accepted' | 'rejected' | 'void';
}

/** How a bid compares with the player's value: usually close, sometimes a big overpay, rarely a lowball. */
function bidFactor(rng: Rng): number {
  const r = rng();
  if (r < 0.15) return 1.2 + rng() * 0.45;
  if (r < 0.22) return 0.75 + rng() * 0.15;
  return Math.exp(normal(rng, 0, 0.1));
}

/**
 * Each window a few of the user's players attract bids. Better players and
 * young ones with a future draw more interest.
 */
export function generateIncomingBids(state: GameState, data: GameData): IncomingBid[] {
  const rng = stream(state.seed, 'incoming', state.season);
  const squad = state.clubs[state.user].squad.map((id) => state.players[id]);
  const weight = (p: PlayerState) =>
    Math.exp((p.ovr - 75) / 4) * (p.age <= 23 ? 1 + Math.max(0, p.pot - p.ovr) / 8 : 1) * (p.age >= 32 ? 0.2 : 1);
  const count = 2 + (rng() < 0.5 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
  const pool = squad.slice();
  const bids: IncomingBid[] = [];
  for (let k = 0; k < count && pool.length; k++) {
    const p = pool.splice(weightedIndex(rng, pool.map(weight)), 1)[0];
    const suitors = state.clubs.filter(
      (c) => c.id !== state.user && c.squad.length < MAX_SQUAD && p.ovr <= capacity(c.rep) + 3 && c.cash >= p.value * 0.8,
    );
    const n = rng() < 0.35 ? 2 : 1;
    const used = new Set<string>();
    for (let b = 0; b < n; b++) {
      const fee = roundFee(p.value * bidFactor(rng));
      const local = suitors.filter((c) => c.cash >= fee && !used.has(String(c.id)));
      let club = EXTERNAL;
      let name: string;
      if (local.length && rng() < 0.6) {
        const c = local[Math.floor(rng() * local.length)];
        club = c.id;
        name = data.meta.gameClubs[c.id];
      } else {
        name = foreignBidder(state, data, p.ovr, rng);
      }
      if (used.has(club === EXTERNAL ? name : String(club))) continue;
      used.add(club === EXTERNAL ? name : String(club));
      bids.push({ player: p.id, club, name, fee, status: 'open' });
    }
  }
  return bids;
}

function foreignBidder(state: GameState, data: GameData, ovr: number, rng: Rng): string {
  const rows = data.seasons[state.season];
  const names = marketPool(state, data)
    .filter((q) => Math.abs(q.ovr - ovr) <= 2)
    .map((q) => data.meta.clubNames[rows[q.id]?.[6] ?? 0])
    .filter((n) => n !== 'Free agent');
  return names.length ? names[Math.floor(rng() * names.length)] : 'A club abroad';
}

export function acceptIncomingBid(state: GameState, data: GameData, index: number): string | null {
  const bid = state.bids[index];
  if (!bid || bid.status !== 'open') return 'This bid is no longer on the table.';
  if (!canSell(state)) return `You need at least ${MIN_SQUAD} players.`;
  if (state.players[bid.player].club !== state.user) return 'He has already left.';
  if (bid.club !== EXTERNAL) {
    const buyer = state.clubs[bid.club];
    if (buyer.cash < bid.fee || buyer.squad.length >= MAX_SQUAD) {
      bid.status = 'void';
      return `${bid.name} have pulled out: they spent their budget on deadline day.`;
    }
  }
  transfer(state, data, bid.player, bid.club, bid.fee, bid.name);
  bid.status = 'accepted';
  for (const b of state.bids) if (b !== bid && b.player === bid.player && b.status === 'open') b.status = 'void';
  return null;
}

export function rejectIncomingBid(state: GameState, index: number): void {
  const bid = state.bids[index];
  if (bid && bid.status === 'open') bid.status = 'rejected';
}

export function canSell(state: GameState): boolean {
  return state.clubs[state.user].squad.length > MIN_SQUAD;
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

