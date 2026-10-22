// Every change a manager makes, as plain data. Single player applies them
// straight away; a two-player room appends them to the room's log and both
// browsers replay the log, in the same order, through applyAction.
import type { ClubInfo } from './clubs';
import type { GameData } from './data';
import { chooseSlot, emptySlots, pickCandidate, playDraftSeason, startRedraft, swapSpots } from './draft';
import { asUser, endSeason, type GameState, newGame, REAL_CLUBS, type Stage } from './game';
import type { Formation } from './positions';
import { type PlayStyle, STYLES } from './styles';

export type Action =
  | { t: 'pick'; player: number }
  | { t: 'slot'; slot: number }
  | { t: 'redraft'; slot: number }
  | { t: 'swap'; a: number; b: number }
  /** the club's play style, before a season */
  | { t: 'style'; style: PlayStyle }
  /** the club's star (a starter in its XI), before a season; null goes back to the automatic choice */
  | { t: 'star'; player: number | null }
  /** single player: play the season */
  | { t: 'play' }
  /** room: XI set (or not), waiting for the host */
  | { t: 'ready'; on: boolean }
  /** room, host only: play the season once both managers are ready */
  | { t: 'simulate' }
  /** done with the season review: on to the summer */
  | { t: 'continue' };

/** A room's manager: his club and formation. */
export interface RoomManager {
  club: ClubInfo;
  formation: Formation;
  style?: PlayStyle;
}

/** The host's club is the 21st, the guest's the 22nd. */
export const HOST = REAL_CLUBS;
export const GUEST = REAL_CLUBS + 1;

/** A two-player career, started when the guest joins. */
export function newRoomGame(data: GameData, seed: number, rules: GameState['rules'], host: RoomManager, guest: RoomManager): GameState {
  // Two clubs can't share a name: the guest's gets a suffix.
  const taken = new Set([...data.meta.gameClubs.slice(0, REAL_CLUBS), host.club.name]);
  let club = guest.club;
  for (let n = 2; taken.has(club.name); n++) club = { ...guest.club, name: `${guest.club.name} ${n}` };
  const state = newGame(data, HOST, seed, 'draft', host.formation, host.club, rules, [], { club, formation: guest.formation });
  if (host.style && STYLES[host.style]) state.clubs[HOST].style = host.style;
  if (guest.style && STYLES[guest.style]) state.clubs[GUEST].style = guest.style;
  return state;
}

const CHANGES = new Set<Action['t']>(['pick', 'slot', 'redraft', 'swap', 'style', 'star']);

/** Applies one manager's action. Returns why it was refused, or null. */
export function applyAction(state: GameState, data: GameData, club: number, a: Action): string | null {
  const mp = state.mp;
  const view = mp?.views[club];
  if (mp && !view) return 'Not a manager in this room.';
  if (CHANGES.has(a.t)) {
    // Changing the team takes back a ready.
    if (view) view.ready = false;
    return asUser(state, club, () => {
      switch (a.t) {
        case 'pick': return pickCandidate(state, data, a.player);
        case 'slot': return chooseSlot(state, data, a.slot);
        case 'redraft': return startRedraft(state, data, a.slot);
        case 'swap': return swapSpots(state, a.a, a.b);
        case 'style':
          if (!STYLES[a.style]) return 'No such style.';
          if (state.stage !== 'draft' && state.stage !== 'summer') return 'Not during the season.';
          state.clubs[state.user].style = a.style;
          return null;
        case 'star': {
          if (state.stage !== 'draft' && state.stage !== 'summer') return 'Not during the season.';
          const c = state.clubs[state.user];
          if (a.player === null) {
            delete c.starPick;
            return null;
          }
          if (typeof a.player !== 'number' || a.player < 0 || !c.xi.includes(a.player)) return 'Only a starter can be the star.';
          c.starPick = a.player;
          return null;
        }
      }
      return null;
    });
  }
  switch (a.t) {
    case 'play':
      if (mp) return 'The host plays the season.';
      return playDraftSeason(state, data);
    case 'ready': {
      if (!view) return 'Only in a room.';
      if (a.on) {
        const problem = asUser(state, club, () =>
          state.stage !== 'summer' || state.draft?.slot !== null ? 'Finish the draft first.' : emptySlots(state).length ? 'Fill every position first.' : null);
        if (problem) return problem;
      }
      view.ready = a.on;
      return null;
    }
    case 'simulate': {
      if (!mp || club !== mp.humans[0]) return 'Only the host can play the season.';
      if (!mp.humans.every((h) => mp.views[h].ready)) return 'Both managers must be ready.';
      return playDraftSeason(state, data);
    }
    case 'continue': {
      if (!mp) {
        if (state.stage !== 'results') return 'Not now.';
        endSeason(state, data);
        return null;
      }
      if (view!.stage !== 'results') return 'Not now.';
      view!.done = true;
      // The summer starts once both managers have seen the review.
      if (mp.humans.every((h) => mp.views[h].done)) endSeason(state, data);
      return null;
    }
  }
  return null;
}

/** The game as one manager of a room sees it: his club, draft, stage and stats. */
export function viewFor(state: GameState, club: number): GameState {
  const v = state.mp?.views[club];
  if (!v) return state;
  return {
    ...state,
    user: club,
    draft: v.draft,
    stage: v.stage as Stage,
    devReport: v.devReport,
    history: state.history.map((h) => (h.byUser?.[club] ? { ...h, ...h.byUser[club] } : h)),
    result: state.result?.cupStatsByClub ? { ...state.result, cupStats: state.result.cupStatsByClub[club] ?? [] } : state.result,
  };
}

/** The other manager of a room. */
export function rivalOf(state: GameState, club: number): number | null {
  return state.mp?.humans.find((h) => h !== club) ?? null;
}
