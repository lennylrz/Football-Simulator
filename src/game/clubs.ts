// The 20 clubs of 2015/16. Plain club colours only: no crests or kits.
// `rep` (0-100) is a 2015 reputation tier, `budget` the 2015 transfer budget
// in €m.
export interface ClubInfo {
  name: string;
  short: string;
  code: string;
  primary: string;
  secondary: string;
  rep: number;
  budget: number;
}

export const CLUBS: ClubInfo[] = [
  { name: 'AFC Bournemouth', short: 'Bournemouth', code: 'BOU', primary: '#DA291C', secondary: '#000000', rep: 55, budget: 20 },
  { name: 'Arsenal', short: 'Arsenal', code: 'ARS', primary: '#EF0107', secondary: '#FFFFFF', rep: 89, budget: 90 },
  { name: 'Aston Villa', short: 'Aston Villa', code: 'AVL', primary: '#670E36', secondary: '#95BFE5', rep: 66, budget: 30 },
  { name: 'Chelsea', short: 'Chelsea', code: 'CHE', primary: '#034694', secondary: '#FFFFFF', rep: 93, budget: 120 },
  { name: 'Crystal Palace', short: 'Crystal Palace', code: 'CRY', primary: '#1B458F', secondary: '#C4122E', rep: 63, budget: 25 },
  { name: 'Everton', short: 'Everton', code: 'EVE', primary: '#003399', secondary: '#FFFFFF', rep: 74, budget: 40 },
  { name: 'Leicester City', short: 'Leicester', code: 'LEI', primary: '#003090', secondary: '#FDBE11', rep: 60, budget: 20 },
  { name: 'Liverpool', short: 'Liverpool', code: 'LIV', primary: '#C8102E', secondary: '#FFFFFF', rep: 86, budget: 90 },
  { name: 'Manchester City', short: 'Man City', code: 'MCI', primary: '#6CABDD', secondary: '#1C2C5B', rep: 92, budget: 160 },
  { name: 'Manchester United', short: 'Man United', code: 'MUN', primary: '#DA291C', secondary: '#FBE122', rep: 92, budget: 150 },
  { name: 'Newcastle United', short: 'Newcastle', code: 'NEW', primary: '#241F20', secondary: '#FFFFFF', rep: 70, budget: 35 },
  { name: 'Norwich City', short: 'Norwich', code: 'NOR', primary: '#FFF200', secondary: '#00A650', rep: 57, budget: 15 },
  { name: 'Southampton', short: 'Southampton', code: 'SOU', primary: '#D71920', secondary: '#FFFFFF', rep: 70, budget: 30 },
  { name: 'Stoke City', short: 'Stoke', code: 'STK', primary: '#E03A3E', secondary: '#FFFFFF', rep: 66, budget: 25 },
  { name: 'Sunderland', short: 'Sunderland', code: 'SUN', primary: '#EB172B', secondary: '#FFFFFF', rep: 63, budget: 20 },
  { name: 'Swansea City', short: 'Swansea', code: 'SWA', primary: '#FFFFFF', secondary: '#121212', rep: 65, budget: 20 },
  { name: 'Tottenham Hotspur', short: 'Spurs', code: 'TOT', primary: '#FFFFFF', secondary: '#132257', rep: 82, budget: 60 },
  { name: 'Watford', short: 'Watford', code: 'WAT', primary: '#FBEE23', secondary: '#ED2127', rep: 57, budget: 25 },
  { name: 'West Bromwich Albion', short: 'West Brom', code: 'WBA', primary: '#122F67', secondary: '#FFFFFF', rep: 62, budget: 20 },
  { name: 'West Ham United', short: 'West Ham', code: 'WHU', primary: '#7A263A', secondary: '#1BB1E7', rep: 68, budget: 35 },
];

export const BIG_SIX = ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham Hotspur'];

/** Highest overall a club of this reputation can usually attract. */
export function capacity(rep: number): number {
  return 58 + 0.3 * rep;
}

export function repLabel(rep: number): string {
  if (rep >= 88) return 'Elite';
  if (rep >= 80) return 'Big club';
  if (rep >= 70) return 'Established';
  if (rep >= 62) return 'Mid-table';
  return 'Small club';
}
