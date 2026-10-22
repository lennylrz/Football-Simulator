// Scouting blurbs for the draft screen's candidate panel: a short kicker
// (overline) and a one-to-three sentence paragraph. The era's biggest names
// have hand-written copy (blurbData.ts); everyone else gets a blurb built from
// a position archetype, an age/development line and, sometimes, one concrete
// detail. Choices are pseudo-random but deterministic per player id and seed,
// so a player reads the same throughout a career.
import { SPECIAL } from './blurbData';

export interface BlurbInput {
  id: number;
  era: number;
  name: string;
  nation: string;
  /** positions, e.g. "ST,CF"; the first is his main one */
  pos: string;
  age: number;
  ovr: number;
  pot: number;
  /** market value in €k (0 when unknown) */
  value: number;
  club?: string;
  /** hidden ratings: say nothing that gives away ovr, pot or how good he is */
  hidden?: boolean;
  /** career seed, to vary the copy between careers */
  seed?: number;
}

export interface Blurb {
  kicker: string;
  text: string;
  /** hand-written copy for one of the era's stars */
  special: boolean;
}

type Group = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST';

interface Archetype {
  kicker: string[];
  lines: string[];
  when?: (x: BlurbInput) => boolean;
}

const GROUP: Record<string, Group> = {
  GK: 'GK', CB: 'CB', LB: 'FB', RB: 'FB', LWB: 'FB', RWB: 'FB',
  CDM: 'DM', CM: 'CM', CAM: 'AM', LM: 'W', RM: 'W', LW: 'W', RW: 'W', CF: 'ST', ST: 'ST',
};

// {s} is the player's surname.
const ARCHETYPES: Record<Group, Archetype[]> = {
  GK: [
    { kicker: ['THE SHOT-STOPPER', 'CAT-LIKE'], lines: [
      'Reflexes like a cat and a habit of making the impossible look routine.',
      '{s} lives for the point-blank save; strikers walk away shaking their heads.',
    ] },
    { kicker: ['THE SWEEPER-KEEPER'], lines: [
      'Comfortable with the ball at his feet and happy to patrol the edge of his box.',
      'Plays like an extra outfielder. A high defensive line will love him.',
    ] },
    { kicker: ['THE COMMANDER', 'MASTER OF HIS AREA'], lines: [
      'Claims every cross and organises the back four at full volume.',
      'Big presence, bigger voice. Nobody wanders into his six-yard box uninvited.',
    ] },
    { kicker: ['PENALTY KILLER'], lines: [
      "Studies penalty takers like exam notes. A shootout is a coin toss weighted in his favour.",
      'Has a knack for guessing right from twelve yards, and strikers know it.',
    ] },
    { kicker: ['THE CALM ONE', 'ICE IN THE VEINS'], lines: [
      'Never flaps, never panics. Boring in the very best way.',
      'Unflappable under a high ball and unbothered by a hostile crowd.',
    ] },
    { kicker: ['THE DISTRIBUTOR'], lines: [
      'Long, flat throws and raking kicks start attacks before the opposition has reset.',
      'His first job is saves, his second is quarterbacking the counter-attack. He does both.',
    ] },
  ],
  CB: [
    { kicker: ['THE ENFORCER', 'NO NONSENSE'], lines: [
      'Wins his duel, then wins the next one too. Strikers leave knowing they have been in a game.',
      'Physical, uncompromising and never shy of a tackle. {s} defends like it is personal.',
    ] },
    { kicker: ['THE BALL-PLAYER', 'CULTURED DEFENDER'], lines: [
      'Steps into midfield with the ball and breaks lines with a single pass.',
      'Defends first, but give {s} space and he will start the attack himself.',
    ] },
    { kicker: ['KING OF THE AIR', 'SET-PIECE MENACE'], lines: [
      'Dominant in the air at both ends, and a genuine menace from corners.',
      'Attacks every header like it owes him money. Expect a few goals from set pieces.',
    ] },
    { kicker: ['THE READER', 'ONE STEP AHEAD'], lines: [
      'Not the quickest, never needs to be. Reads danger two passes early.',
      'Positioning so good he rarely has to make a tackle; the ball just finds him.',
    ] },
    { kicker: ['THE ORGANISER', 'THE VOICE'], lines: [
      'Talks all game, points constantly and keeps the line exactly where it should be.',
      'A born organiser. The defenders around him look better simply for standing there.',
    ] },
    { kicker: ['THE LAST LINE', 'THE BLOCKER'], lines: [
      'Last-ditch tackles and blocked shots. Will put his face in front of a volley.',
      'Lives for the goal-saving block. Clean sheets are his love language.',
    ] },
    { kicker: ['RECOVERY PACE'], lines: [
      'Quick enough to cover everyone else\'s mistakes, which is precisely the job.',
      'Rapid across the ground for a centre-back. Balls over the top hold no fear for him.',
    ] },
  ],
  FB: [
    { kicker: ['THE OVERLAPPER', 'FLYING FULL-BACK'], lines: [
      'Lives on the touchline and turns up in the final third like an extra winger.',
      'Bombs forward at every chance; the winger in front of him never runs out of support.',
    ] },
    { kicker: ['THE CROSSER', 'DELIVERY MAN'], lines: [
      'Whips in deliveries with pace and bend. Centre-forwards love him.',
      'One of those full-backs whose crosses end up on the scoresheet as assists.',
    ] },
    { kicker: ['THE INVERTED FULL-BACK'], lines: [
      'Tucks into midfield in possession and helps run the game from deep.',
      'A modern full-back: half defender, half midfielder, always available for the pass.',
    ] },
    { kicker: ['THE LOCKDOWN', 'DEFENCE FIRST'], lines: [
      'Defends first and asks questions later. Opposition wingers have a quiet afternoon.',
      'Tight, tenacious and hard to beat one-on-one. {s} takes the flank away.',
    ] },
    { kicker: ['THE ENGINE', 'UP AND DOWN'], lines: [
      'Up and down the flank all afternoon and still sprinting in stoppage time.',
      'Lungs of a marathon runner. Covers the whole touchline, twice.',
    ] },
  ],
  DM: [
    { kicker: ['THE DESTROYER', 'BALL WINNER'], lines: [
      'Breaks up play, wins it back, gives it simply. Does the dirty work so others can shine.',
      'Tackles, interceptions and a sharp elbow. Playmakers hate meeting him.',
    ] },
    { kicker: ['THE ANCHOR'], lines: [
      'Sits in front of the back four like a bouncer at the door.',
      'Never strays, never gets caught upfield. The team\'s shape is built around him.',
    ] },
    { kicker: ['THE REGISTA', 'THE DEEP PLAYMAKER'], lines: [
      'Drops between the centre-backs and sprays the ball wherever it is needed.',
      'Dictates from deep: a quiet first touch, a head-up look, a raking pass.',
    ] },
    { kicker: ['THE METRONOME', 'TEMPO SETTER'], lines: [
      'Short passes, perfect tempo, almost never gives it away.',
      'Keeps the ball ticking like a clock. Unglamorous, invaluable.',
    ] },
    { kicker: ['THE SHIELD', 'THE SWEEPER'], lines: [
      'Positionally perfect. You rarely see him tackle because he has already intercepted it.',
      'Mops up everything in front of the defence. Counter-attacks die at his feet.',
    ] },
  ],
  CM: [
    { kicker: ['BOX TO BOX', 'THE ALL-ROUNDER'], lines: [
      'Defends his own box and arrives in theirs. Lungs the size of a stadium.',
      'Does a bit of everything and all of it well; tackles, carries, scores.',
    ] },
    { kicker: ['THE CONDUCTOR', 'THE ORCHESTRATOR'], lines: [
      'Controls the tempo and keeps the ball moving. The team plays to his rhythm.',
      'Always available, always calm. {s} turns possession into control.',
    ] },
    { kicker: ['THE GRAFTER', 'THE WORKHORSE'], lines: [
      'Covers every blade of grass and never hides. Managers adore him.',
      'Wins second balls, closes down, runs the channels. The glue in any midfield.',
    ] },
    { kicker: ['THE LATE RUNNER', 'THE GHOST'], lines: [
      'Ghosts into the box unmarked and gets on the end of things.',
      'Times his runs into the area perfectly. Midfielders are not meant to score this often.',
    ] },
    { kicker: ['LONG-RANGE THREAT', 'THE THUNDERBOLT'], lines: [
      'Give him a yard outside the box and the net starts to ripple.',
      'Owns a shot that goalkeepers have nightmares about. Twenty-five yards is close range.',
    ] },
    { kicker: ['THE CARRIER', 'THE DRIVER'], lines: [
      'Picks the ball up deep and drives through the lines with it.',
      'Strong in possession and quick over five yards; a press-breaker on legs.',
    ] },
  ],
  AM: [
    { kicker: ['THE NUMBER TEN', 'THE PLAYMAKER'], lines: [
      'Floats between the lines and finds the pass nobody else saw.',
      'Lives in the pockets of space behind midfield. One turn and the defence is facing its own goal.',
    ] },
    { kicker: ['THE CREATOR', 'ASSIST MACHINE'], lines: [
      'Assists are his currency, and he is never short.',
      'Sees the gap before it opens. Strikers queue up to play alongside him.',
    ] },
    { kicker: ['THE TRICKSTER', 'MISCHIEF MAKER'], lines: [
      'Feints, flicks and nutmegs. Plays with a grin and a little bit of mischief.',
      'Has a trick for every situation and the nerve to try it in front of a full stadium.',
    ] },
    { kicker: ['THE FREE SPIRIT', 'FREE ROLE'], lines: [
      'Drifts wherever the space is, and space has a habit of finding him.',
      'Impossible to pick up because even he doesn\'t know where he\'s going next.',
    ] },
    { kicker: ['DEAD-BALL SPECIALIST'], lines: [
      'Dead balls become live chances when he is standing over them.',
      'Free-kicks, corners, penalties: if it is a set piece, {s} wants it.',
    ] },
    { kicker: ['THE SHADOW STRIKER'], lines: [
      'Arrives late in the box and finishes like a forward.',
      'Half playmaker, half striker. Defenders never quite know who should be marking him.',
    ] },
  ],
  W: [
    { kicker: ['THE SPEEDSTER', 'PACE TO BURN'], lines: [
      'Knocks it past the full-back and wins the race. Every time.',
      'Pure pace. Give {s} a yard of grass and he is gone.',
    ] },
    { kicker: ['THE INSIDE FORWARD', 'CUT INSIDE'], lines: [
      'Starts wide, cuts in onto the stronger foot and goes for goal.',
      'A winger with a striker\'s instincts; drifts in off the flank and shoots on sight.',
    ] },
    { kicker: ['THE DRIBBLER', 'ONE-ON-ONE'], lines: [
      'One-on-one he is a nightmare: feet faster than the defender\'s eyes.',
      'Takes on his man for fun. Full-backs need a lie-down after ninety minutes with him.',
    ] },
    { kicker: ['THE CLASSIC WINGER', 'TO THE BYLINE'], lines: [
      'Old-fashioned and proud of it: down the line and whip it in.',
      'Hugs the touchline, stretches the pitch and puts it on a plate for the striker.',
    ] },
    { kicker: ['THE WORKHORSE', 'TWO-WAY WINGER'], lines: [
      'Tracks back, presses high and still finds the energy for the final ball.',
      'A winger his full-back loves; defends the flank as hard as he attacks it.',
    ] },
    { kicker: ['THE ENTERTAINER', 'BRING POPCORN'], lines: [
      'Step-overs, flicks, fans out of their seats. Bring popcorn.',
      'Pure flair. {s} plays as though the highlights reel is already rolling.',
    ] },
  ],
  ST: [
    { kicker: ['THE POACHER', 'SIX-YARD SPECIALIST'], lines: [
      'Lives on the shoulder of the last man. Doesn\'t need many touches; just the one.',
      'Invisible for eighty-nine minutes, decisive in the ninetieth. That is the job.',
    ] },
    { kicker: ['THE TARGET MAN', 'THE BATTERING RAM'], lines: [
      'Holds it up, wins the long ball, brings others into play. Centre-backs leave with bruises.',
      'A focal point: hit him with anything and it sticks. Strong in the air and stronger in the body.',
    ] },
    { kicker: ['THE FALSE NINE'], lines: [
      'Drops deep, drags defenders out of position and lets the runners exploit the gap.',
      'More playmaker than penalty-box striker. The goals around him go up when he plays.',
    ] },
    { kicker: ['THE SPRINTER', 'IN BEHIND'], lines: [
      'Runs in behind all day. One through ball and he is through on goal.',
      'Defenders daren\'t push up against him. Pace that bends a whole back line.',
    ] },
    { kicker: ['THE PRESSER', 'FIRST LINE OF DEFENCE'], lines: [
      'Harries goalkeepers and centre-backs into mistakes, then punishes them.',
      'Presses like a terrier. Half his goals start with him stealing the ball.',
    ] },
    { kicker: ['THE COMPLETE FORWARD'], lines: [
      'Scores with either foot, with his head, from distance. Link play to match.',
      'Can drop in, run beyond or battle in the box. {s} does the lot.',
    ] },
    { kicker: ['FOX IN THE BOX'], lines: [
      'Pops up wherever the ball drops. Never pretty, always effective.',
      'Rebounds, deflections, scrappy tap-ins: they all count, and he gets lots of them.',
    ] },
    { kicker: ['THE SNIPER', 'CLINICAL'], lines: [
      'Clinical: few chances wasted, fewer goalkeepers impressed.',
      'Picks his spot and hits it. Expected goals models look at him and shrug.',
    ] },
    { kicker: ['THE LATE BLOOMER'], when: (x) => x.age >= 26, lines: [
      'Took the long road to the top and is enjoying every minute of the view.',
      'Came to it late, and has been making up for lost time ever since.',
    ] },
    { kicker: ['GOAL MERCHANT', 'THE JOURNEYMAN'], when: (x) => x.age >= 27, lines: [
      'Has scored at every club he has played for. Moves on, keeps scoring.',
      'Give him a shirt and a penalty box anywhere in Europe and the goals follow.',
    ] },
  ],
};

// Where he is in his career. The non-hidden lines may lean on rating and
// headroom; the hidden ones go by age alone. Nothing dismissive, ever.
const ARC = {
  teenBig: [
    'One for the future: the ceiling is enormous.',
    'Raw today, frightening tomorrow.',
    'Give him two seasons and you may not recognise him.',
    'The sort of teenager clubs build five-year plans around.',
    'Scouts have been queuing at his training ground for months.',
  ],
  teenMid: [
    'Still learning, and learning quickly.',
    'A teenager with a sensible head and plenty of upside.',
    'Young, keen and getting better every month.',
  ],
  teenReady: [
    'Remarkably polished for a teenager.',
    'Plays with a maturity well beyond his years.',
    'Already does the basics like a seasoned pro.',
  ],
  youngBig: [
    'Plenty still to come: his best years are ahead of him.',
    'Improving fast; the next step could be a big one.',
    'A project with a serious upside.',
    'On the way up, and nobody knows quite how far.',
  ],
  youngMid: [
    'Still climbing, steadily.',
    'Should keep getting better for a few seasons yet.',
    'There is a little more in the tank.',
  ],
  youngSet: [
    'Settled into his level early, and it is a useful one.',
    'Mature for his age and remarkably consistent.',
    'What you see is what you get: dependable, week in, week out.',
  ],
  primeGrow: [
    'A late developer still finding new levels.',
    'In his prime and somehow still improving.',
    'Peaking late, which makes him exciting.',
  ],
  primeTop: [
    'At his peak now, and the peak is high.',
    'What you see is what you get: and what you get is very good.',
    'Peak years, peak performances.',
    'In the prime of his career and playing like it.',
  ],
  prime: [
    'At his peak now: steady, reliable, ready to play every week.',
    'In his prime, with experience and legs in perfect balance.',
    'What you see is what you get: and what you get is honest and reliable.',
    'Knows his game inside out and delivers it every week.',
  ],
  vetTop: [
    'Still among the very best, and he knows exactly how to stay there.',
    'Class is permanent, and he has plenty of it.',
    'Wiser than ever, and still a big-game player.',
  ],
  vet: [
    'Experience you simply cannot coach.',
    'Knows every trick in the book, and a few that are not in it yet.',
    'Brings calm to a dressing room and know-how to the pitch.',
    'Reads the game a second faster than everyone else.',
    'A wise head; the game still comes easily to him.',
  ],
  teenHidden: [
    'Still a teenager, still a mystery: that is half the fun.',
    'Young enough that nobody quite knows how good he will get.',
    'A teenager with everything still to prove, and everything to play for.',
  ],
  youngHidden: [
    'Young, hungry and still writing his story.',
    'Early in his career, with the best years in front of him.',
    'Still young enough to surprise a few people.',
  ],
  primeHidden: [
    'In the prime years of his career.',
    'Right in the thick of his peak years.',
    'At the age where legs and experience meet.',
  ],
  vetHidden: [
    'Experience you simply cannot coach.',
    'Knows every trick in the book.',
    'A seasoned pro who has seen it all.',
  ],
};

const KICKERS = {
  wonderkid: ['ONE FOR THE FUTURE', 'WONDERKID ALERT', 'THE NEXT BIG THING'],
  elite: ['WORLD CLASS', 'THE REAL DEAL', 'TOP DRAWER'],
  veteran: ['THE OLD HEAD', 'THE VETERAN', 'BEEN THERE, DONE IT'],
};

const BIG_CLUBS = [
  'real madrid', 'barcelona', 'bayern', 'paris saint', 'juventus', 'atlético', 'atletico', 'dortmund',
  'internazionale', 'manchester', 'chelsea', 'liverpool', 'arsenal', 'tottenham', 'milan', 'napoli',
];

export function isBigClub(club: string): boolean {
  const c = club.toLowerCase();
  return c === 'inter' || BIG_CLUBS.some((b) => c.includes(b));
}

/** "L. Messi" -> "Messi"; "Rodri" -> "Rodri". */
export function surname(name: string): string {
  const i = name.indexOf('. ');
  return i >= 0 && i <= 3 ? name.slice(i + 2) : name;
}

export function formatValue(k: number): string {
  if (k >= 1000) return `€${(k / 1000).toFixed(k >= 10000 ? 0 : 1).replace(/\.0$/, '')}m`;
  return `€${Math.round(k)}k`;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join(':')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Every line a player can be given, for tests. */
export const ALL_ARCHETYPES = ARCHETYPES;
export const ALL_ARCS = ARC;

export function playerBlurb(x: BlurbInput): Blurb {
  const seed = x.seed ?? 0;
  const roll = (salt: string) => hash(x.id, seed, salt);
  const pick = <T>(arr: T[], salt: string): T => arr[roll(salt) % arr.length];

  const star = SPECIAL[x.era]?.[x.id];
  if (star) {
    const [kicker, text] = pick(star.v, 'special');
    return { kicker, text, special: true };
  }

  const s = surname(x.name);
  const group = GROUP[x.pos.split(',')[0].trim()] ?? 'CM';
  const options = ARCHETYPES[group].filter((a) => !a.when || a.when(x));
  const arch = pick(options, 'arch');
  const identity = pick(arch.lines, 'line').replaceAll('{s}', s);

  const hidden = !!x.hidden;
  const room = x.pot - x.ovr;
  const band = x.age <= 19 ? 'teen' : x.age <= 25 ? 'young' : x.age <= 30 ? 'prime' : 'vet';
  let arcs: string[];
  if (hidden) arcs = ARC[`${band}Hidden`];
  else if (band === 'teen') arcs = room >= 10 ? ARC.teenBig : room >= 4 ? ARC.teenMid : ARC.teenReady;
  else if (band === 'young') arcs = room >= 8 ? ARC.youngBig : room >= 3 ? ARC.youngMid : ARC.youngSet;
  else if (band === 'prime') arcs = room >= 3 ? ARC.primeGrow : x.ovr >= 82 ? ARC.primeTop : ARC.prime;
  else arcs = x.ovr >= 82 ? ARC.vetTop : ARC.vet;
  const arc = pick(arcs, 'arc');

  // One concrete detail, sometimes.
  const club = x.club && x.club !== 'Free agent' ? x.club : '';
  const facts: string[] = [];
  if (x.age <= 20) facts.push(`Only ${x.age}.`, `Just ${x.age} years old.`);
  if (x.age >= 33) facts.push(`Still going strong at ${x.age}.`);
  if (club) {
    if (isBigClub(club)) facts.push(`${club} don't hand out shirts to just anyone.`, `Currently on the books at ${club}.`);
    else facts.push(`Currently plying his trade at ${club}.`, `${club}'s best-kept secret may not stay secret for long.`);
  }
  if (!hidden) {
    if (x.value > 0) facts.push(x.value >= 40000 ? `A ${formatValue(x.value)} valuation says the market agrees.` : `Valued at ${formatValue(x.value)}.`);
  }
  let fact = facts.length && roll('fact?') % 100 < 55 ? pick(facts, 'fact') : '';

  let kicker = pick(arch.kicker, 'kicker');
  const k = roll('kick') % 100;
  if (!hidden && band === 'teen' && room >= 10 && k < 50) kicker = pick(KICKERS.wonderkid, 'kw');
  else if (!hidden && x.ovr >= 85 && k < 40) kicker = pick(KICKERS.elite, 'ke');
  else if (band === 'vet' && k < 25) kicker = pick(KICKERS.veteran, 'kv');

  // Order varies a little: usually identity first, sometimes the arc leads.
  const parts = roll('order') % 4 === 0 ? [arc, identity] : [identity, arc];
  if (fact && parts.join(' ').length + fact.length > 230) fact = '';
  if (fact) parts.push(fact);
  return { kicker, text: parts.join(' '), special: false };
}
