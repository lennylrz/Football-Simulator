// What the career hub shows: date, calendar, current step and headlines.
import { SEASON_YEARS, type GameData } from '../game/data';
import { EXTERNAL, type GameState, seasonFixtures, topTransfers } from '../game/game';
import { clubOf, money, ordinal } from './ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function hubDate(season: number): Date {
  return new Date(Date.UTC(SEASON_YEARS[season], 7, 7));
}

export function longDate(d: Date): string {
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function shortDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export interface CalendarDay {
  name: string;
  day: number;
  today: boolean;
  match?: string;
}

/** Seven days from today; the first Saturday holds the opening league match. */
export function calendar(state: GameState, data: GameData): CalendarDay[] {
  const start = hubDate(state.season);
  const first = seasonFixtures(state)[0].find(([h, a]) => h === state.user || a === state.user);
  let matchSet = false;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    const day: CalendarDay = { name: DAYS[d.getUTCDay()], day: d.getUTCDate(), today: i === 0 };
    if (!matchSet && i > 0 && d.getUTCDay() === 6 && first) {
      const home = first[0] === state.user;
      day.match = `${clubOf(data, home ? first[1] : first[0]).short} (${home ? 'H' : 'A'})`;
      matchSet = true;
    }
    return day;
  });
}

export const STEP_LABELS = ['Your Squad', 'Transfer Offers', 'Bids for Your Players', 'Pick Your Team'];

export function currentStep(state: GameState): number {
  if (state.stage === 'lineup') return 3;
  return ['squad', 'offers', 'bids'].indexOf(state.step);
}

export function stepDetail(state: GameState): string {
  switch (currentStep(state)) {
    case 0:
      return 'Review your players before the window opens';
    case 1:
      return `${state.offers.filter((o) => o.status === 'open').length} players available to you`;
    case 2:
      return `${new Set(state.bids.map((b) => b.player)).size} of your players have bids`;
    default:
      return 'Choose your formation, then play the season';
  }
}

export interface Headline {
  date: string;
  text: string;
  tag?: 'NEW!' | 'EXCLUSIVE';
}

export interface Feature {
  label: string;
  figure: string;
  sub: string;
  caption: string;
}

export function feature(state: GameState, data: GameData): Feature {
  const club = clubOf(data, state.user);
  const last = state.history[state.history.length - 1];
  if (!last) {
    return {
      label: 'Summer Budget',
      figure: money(state.clubs[state.user].cash),
      sub: `Board approval · ${shortDate(new Date(hubDate(0).getTime() - 2 * 86_400_000))}`,
      caption: `Board Confirms ${money(state.clubs[state.user].cash)} Summer Budget`,
    };
  }
  const finish = last.table.findIndex((r) => r.club === state.user) + 1;
  return {
    label: `Last Season · ${SEASON_YEARS[last.season]}/${String(SEASON_YEARS[last.season] + 1).slice(2)}`,
    figure: ordinal(finish),
    sub: `${last.table.find((r) => r.club === state.user)!.pts} points · budget now ${money(state.clubs[state.user].cash)}`,
    caption: finish === 1 ? `${club.name} Crowned Champions` : `${club.name} Finish ${ordinal(finish)}, Summer Budget Set`,
  };
}

export function headlines(state: GameState, data: GameData): Headline[] {
  const club = clubOf(data, state.user);
  const name = (id: number) => data.names[id][0];
  const day = (n: number) => shortDate(new Date(hubDate(state.season).getTime() - n * 86_400_000));
  const out: Headline[] = [];
  const top = topTransfers(state, state.season).find((t) => t.to !== state.user && t.from !== state.user);
  if (top) {
    const buyer = top.to === EXTERNAL ? top.other : clubOf(data, top.to).name;
    out.push({ date: 'NEW!', tag: 'EXCLUSIVE', text: `${buyer} Sign ${name(top.player)} for ${money(top.fee)}` });
  }
  const bid = state.bids.find((b) => b.status === 'open');
  if (bid) out.push({ date: day(1), text: `${bid.name} Bid ${money(bid.fee)} for ${name(bid.player)}` });
  const youth = state.news.find((n) => n.kind === 'youth' && n.club === state.user);
  if (youth && youth.kind === 'youth') out.push({ date: day(2), text: `${club.short} Promote ${name(youth.player)} to the First Team` });
  const retired = state.news.find((n) => n.kind === 'retired' && n.club === state.user);
  if (retired && retired.kind === 'retired') out.push({ date: day(3), text: `${name(retired.player)} Announces His Retirement` });
  const open = state.offers.filter((o) => o.status === 'open').length;
  if (open) out.push({ date: day(4), text: `${open} Players Available to ${club.name}` });
  const last = state.history[state.history.length - 1];
  if (last) out.push({ date: day(5), text: `${clubOf(data, last.table[0].club).name} Crowned League Champions` });
  return out.slice(0, 3);
}
