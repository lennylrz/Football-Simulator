// Dressing-room notes for the summer squad screen: two to four short lines
// about the people in the squad rather than the results. Who is fighting
// whom for a place, who wears the armband, the veteran taking a teenager
// under his wing, who grew, the compatriots settling in, a milestone or a
// club record in sight. Every note is read from what really happened (last
// season's stats, the summer's development report, the draft picks) and the
// squad as it stands; nothing is stored.
//
// Variety: each situation has its own bank of wordings, dealt out in a
// per-career order and turned one step each season, so a career rarely
// hears the same wording twice; the situations themselves are drawn by
// weight from the ones the summer supports.
import type { GameData } from './data';
import { type DevChange, draftOf, type GameState, type SeasonHistory } from './game';
import { AREA, type Area, FORMATIONS, parsePositions, type Position, positionFit } from './positions';
import { type Rng, shuffle, stream } from './rng';
import type { PlayerSeasonStats } from './season';

export interface SquadNote {
  /** the situation, e.g. 'rival.form' or 'mentor' */
  kind: string;
  text: string;
  /** the players the note is about */
  players: number[];
}

/** The longest note. */
export const MAX_NOTE = 140;

// ─────────────────────────── Templates ───────────────────────────
//   {key}        a fact, as is
//   {key|ord}    an ordinal: 1st, 2nd, 100th
//   {key|goal}   with a noun, pluralised: 1 goal, 3 goals
//   {key|~goal}  the same in words up to ten: one goal, three goals
//   {key|w}      the number in words up to ten (W: capitalised)
//   [one|two]    a choice of wordings
// A template whose facts are missing is skipped.

export const SQUAD_BANK: Record<string, string[]> = {
  // a: sub, b: starter, role, avgA, avgB
  'rival.form': [
    '{a} averaged {avgA} off the bench last season. {b} has noticed, and so has everyone else.',
    '{a} wants {role}, and his form says he has a case. {b} is not handing it over quietly.',
    'The coaches have a nice problem: {a} kept knocking on the door last season and {b} has to answer it.',
    '{b} starts the summer in possession of {role}. {a} starts it right behind him, and closing.',
    'Every training session is a trial now. {a} pushed hard for {role} last season; {b} pushed back.',
    '{a} came off the bench and kept changing games. {b} will feel him breathing down his neck all summer.',
    'Healthy competition, the coaches call it. {a} and {b} both want {role}, and both have the numbers.',
    'The quiet battle of the summer: {a}, the impact sub, against {b}, the man in possession.',
    '{a} has made his point from the bench. Now {b} has to make his from the starting XI.',
  ],
  // a, b, role
  'rival.even': [
    '{a} and {b} both want {role}. The coaches say they will decide on the training ground.',
    'Two men, one place: {a} and {b} are going head to head for {role}.',
    '{a} or {b}? The debate over {role} is the first argument of every pre-season meal.',
    'Nothing between them on paper. {a} and {b} will spend the summer trying to change that.',
    '{role|Cap} is up for grabs, and {a} and {b} have both arrived in the shape of their lives.',
    'The coaches flipped a coin over {role} and then put it back in their pocket. {a} and {b} will settle it.',
    '{a} and {b}: same position, same ambition, same rating give or take. Somebody has to sit.',
    'A straight shoot-out for {role} between {a} and {b}. The dressing room is running a sweepstake.',
  ],
  // a: newcomer, b: established, role
  'rival.newcomer': [
    '{a} has arrived for {role}. {b} has been here before and does not plan on moving aside.',
    'New face, old question: can {a} take {role} from {b}?',
    '{b} had {role} to himself last season. Then {a} walked through the door.',
    '{a} turned up with a point to prove, and the man in his way is {b}.',
    'The new man against the old guard: {a} and {b} are both after {role}.',
    '{b} welcomed {a} with a handshake and then went straight back to work. {role|Cap} is not being given away.',
    'First week, first rivalry: {a} wants {role}, and {b} wants to keep it.',
    '{a} is the summer arrival, {b} the incumbent. Their duel for {role} will shape the season.',
  ],
  // a, b, area
  'partners': [
    '{a} and {b} will share the {area}. They finish each other\'s sentences on the pitch, if not off it.',
    'The coaches want {a} and {b} to become a pair people name together, like a good double act.',
    '{a} and {b} have been spending extra hours together on the training ground, learning each other\'s runs.',
    'A partnership to build: {a} and {b} in the {area}. They already have a handshake.',
    '{a} talks, {b} listens. Or the other way round. Either way, the {area} is theirs to share.',
    'Side by side in the {area}: {a} and {b}, two very different players asked to think as one.',
  ],
  // a: captain, seasons, apps, age
  'captain': [
    '{a} keeps the armband. {apps} appearances for the club, and nobody else was even considered.',
    'The armband stays with {a}. After {seasons|~season} here, the dressing room is his.',
    'Captain {a}: the first one in, the last one out, and the one the young players watch.',
    '{a} leads again. The coaches say he never has to raise his voice, which is the point.',
    'No vote needed: {a} is captain. {apps} games for the club will do that.',
    '{a} wears the armband like it was made for him, and after {seasons|~season} maybe it was.',
    'When something needs saying in the dressing room, {a} says it. Captain again.',
    '{a} has been here longest and talks least. He is captain, and nobody argues.',
  ],
  // a: captain, age, ovr
  'captain.first': [
    '{a} takes the armband. At {age}, he is the one the rest look to.',
    'The first captain of a new group: {a}. The coaches did not need long to decide.',
    'Day one, and {a} is already organising the dressing room. He is captain.',
    '{a} has been named captain. He has been through more than most of them put together.',
    'Someone had to lead a squad of strangers. The coaches chose {a}, and the strangers agreed.',
    '{a} gets the armband. He gave a short speech; people say it was the right length.',
  ],
  // a, b
  'leader.contest': [
    'Two leaders, one armband: {a} and {b} both carry the dressing room in their own way.',
    'The captaincy question is open. {a} has the years, {b} has the voice.',
    '{a} or {b} for captain? The coaches are taking their time, and both men know it.',
    'There are two big voices in the dressing room now: {a} and {b}. That can only be good, mostly.',
    '{b} has started to lead by example, and {a}, the senior man, has noticed.',
    'The armband is a conversation this summer. {a} and {b} are both the right answer, which is the problem.',
  ],
  // a, b, area
  'clash': [
    'Words were exchanged between {a} and {b} in training. The coaches called it passion and moved on.',
    'A little clash on the training pitch: {a} and {b} went for the same ball and neither let go.',
    '{a} and {b} had a heated moment at pre-season. They shook hands afterwards. Eventually.',
    'Not every dressing room is quiet. {a} and {b} both want to be the main man in the {area}.',
    'A small spat between {a} and {b} has cleared the air, the coaches insist. Watch this space.',
    'Two strong characters in one {area}: {a} and {b} had a word. Then another word.',
    'The coaches separated {a} and {b} in a training match. Both apologised; both want the same thing.',
  ],
  // a: star, b: the other top player
  'clash.star': [
    'Everything goes through {a}. {b} would like it to go through him now and then, and has said so.',
    '{b} wants a bigger share of the spotlight. {a} is not used to sharing it.',
    'A tense moment in training: {b} wanted the ball, {a} kept it. The coaches are keeping an eye on it.',
    'The team is built around {a}, and {b} has started asking why it cannot be built around two.',
    '{a} and {b} are friends, the club says. Friends who both want to be the star.',
    '{b} has had enough of being the second name on the teamsheet. {a} has had enough of hearing about it.',
  ],
  // a, b
  'topdog': [
    'Who is the main man? {a} and {b} are level at the top of the squad, and both know it.',
    '{a} and {b} are the two best players here, and the race to be called the best of all is on.',
    'The fight for top billing: {a} against {b}, with nothing between them.',
    '{a} has the reputation, {b} has the momentum. The squad\'s first name is up for grabs.',
    'Ask the dressing room who the best player is and you get two answers: {a} and {b}.',
    '{a} and {b} are the stars of this side. One of them will want to be the brighter one.',
  ],
  // a: veteran, b: youngster, ageA, ageB
  'mentor': [
    '{a}, {ageA}, has taken {b}, {ageB}, under his wing. Extra sessions, long chats, the lot.',
    'The coaches have paired {b} with {a} at every drill. Nobody learns faster than from the old pro.',
    '{b} follows {a} around the training ground like a shadow. {a} pretends to mind.',
    '{a} has {gap|~year} on {b}, and he is passing on what he learned in every one of them.',
    'At {ageB}, {b} has the best teacher in the building: {a}, who was doing this before {b} could walk.',
    'Mentor and apprentice: {a} keeps showing {b} the little things that nobody writes down.',
    '{b} says {a} is the reason he stays late after training. {a} says {b} is the reason he feels young.',
    'Every club needs one {a}: at {ageA}, he spends half of training looking after {b}.',
    '{a} has adopted {b}. Lifts to training, video sessions, and an earful when it is needed.',
  ],
  // a: veteran, b: youngster in another area
  'mentor.cross': [
    'Different positions, same lessons: {a} has been looking after {b} since the first day of pre-season.',
    '{b} is the dressing room\'s youngest voice and {a} its oldest. They sit together on the bus.',
    '{a} took {b} aside after training and has not really let go since. The coaches love it.',
    'Not a natural pairing on the pitch, but {a} has become {b}\'s guide off it.',
    '{a}, {ageA}, and {b}, {ageB}: the odd couple of the squad, and inseparable.',
  ],
  // a, gain, from, to
  'growth.top': [
    '{a} grew more than anyone last summer: {from} to {to}. The coaches are not surprised.',
    'Nobody improved like {a}: up {gain|point} to {to}, and still hungry.',
    '{a} came back a different player. {from} last year, {to} now.',
    'The glow-up of the summer belongs to {a}: +{gain}, and he looks it.',
    '{a} put in the work and it shows: a rating of {to}, up from {from}.',
    'The coaches point to {a} when they talk about what this place can do for a player. Up {gain|point}.',
    'Ask {a} how he jumped from {from} to {to} and he shrugs. Ask the fitness coach and he grins.',
  ],
  // a, gain, age, to
  'growth.young': [
    '{a}, {age}, jumped {gain|point} to {to}. The coaches have stopped calling him a prospect.',
    'Still only {age}, {a} added {gain|point} last summer. The ceiling keeps moving.',
    'The kid is not a kid any more: {a}, {age}, is up to {to}.',
    '{a} grew {gain|point} at {age}. Somewhere, a scout who passed on him is wincing.',
    'At {age}, {a} is getting better by the month. Up {gain|point}, and nowhere near done.',
    '{a} has grown up fast: {to} at {age}, and the senior players have started passing to him first.',
  ],
  // a, drop, to
  'growth.dip': [
    '{a} dipped to {to} over the summer. He has been first at training every day since, determined to bounce back.',
    'A quieter summer for {a}, down {drop|point}. The coaches back him to come roaring back.',
    '{a} has a point to prove after slipping to {to}, and the coaches think that is no bad thing.',
    'Down {drop|point}, but {a} has been the busiest man at pre-season. A bounce-back is coming.',
    '{a} took the summer\'s dip to heart. Extra sessions, new diet, same quality underneath.',
    'The numbers dropped for {a}, the hunger did not. The coaches have circled him as one to watch.',
  ],
  // a, age, pot
  'tipped': [
    'The coaches cannot stop talking about {a}. At {age}, they think he can go all the way.',
    '{a}, {age}, is the one the coaches whisper about. The ceiling is very high.',
    'Keep an eye on {a}. The staff have him down as the best young player in the building.',
    '{a} is {age} and already training like a senior pro. The coaches have big plans.',
    'Every club has a teenager the staff swear by. Here, it is {a}.',
    'The scouts say {a} could become something special. At {age}, he is in no rush.',
    'At {age}, {a} has the coaches reaching for comparisons they usually keep to themselves.',
  ],
  // a, age, ovr
  'peak': [
    '{a} is {age}: the age the coaches call a player\'s best years. He has never looked sharper.',
    'At {age}, {a} is entering his prime, and he knows exactly what he wants from it.',
    '{a} turned {age} with his best football ahead of him. The coaches are rubbing their hands.',
    'The sweet spot: {a}, {age}, rated {ovr}, and every bit the complete player.',
    '{a} has the legs of a young man and the head of an old one. At {age}, it is his time.',
  ],
  // a, age
  'twilight': [
    'At {age}, {a} is savouring every session. The young players say he still wins the sprints.',
    '{a} is {age} and still the first name the others look for when it gets tense.',
    'Nobody enjoys training more than {a}. At {age}, he treats every season as a gift.',
    '{a}, {age}, has started passing on his secrets. He has not stopped using them.',
    'The oldest legs in the squad belong to {a}, {age}. The wisest head too.',
    '{a} turned {age} in the summer and celebrated with an extra session. Of course he did.',
    'At {age}, {a} has nothing left to prove and plays like he still has everything to prove.',
  ],
  // a, apps, seasons
  'legend': [
    '{a} has made {apps} appearances for the club. The fans have a song for him now.',
    '{apps} games and {seasons|~season}: {a} is becoming part of the furniture, in the best way.',
    'Nobody in the squad has played more for the club than {a}: {apps} appearances and counting.',
    '{a} has played {apps} times for the club, more than anyone in the squad, and never once held back.',
    'When people talk about this club in years to come, {a} will be in the first sentence. {apps} games so far.',
    '{a} has been here through everything: {seasons|~season}, {apps} appearances.',
  ],
  // a, next, left
  'milestone.apps': [
    '{a} is {left|game} away from his {next|ord} appearance for the club. The cake has been ordered.',
    '{left|Game} to go, and {a} reaches {next} for the club.',
    'A milestone in sight: {a} needs {left|~game} for {next} appearances.',
    '{a} will play his {next|ord} game for the club in the autumn, if all goes to plan. {left|Game} to go.',
    'The kit man has a shirt ready with {next} on the back. {a} needs {left|~game} to earn it.',
  ],
  // a, next, left, goals
  'milestone.goals': [
    '{a} has {goals|goal} for the club and needs {left|~goal} for {next}.',
    '{left|Goal} from {next}: {a} has a milestone in his sights.',
    '{a} is closing on {next} goals for the club. {left|~goal} to go.',
    'Next stop for {a}: {next} goals for the club. He is {left|~goal} away.',
    'The {next|ord} goal is coming for {a}. He has {goals} and is not slowing down.',
  ],
  // a, rec, left, goals
  'record.chase': [
    '{a} needs {left|goal} to break {rec}\'s club scoring record.',
    'The club scoring record is in sight for {a}: {left|~goal} more to pass {rec}.',
    '{rec} set the club record. {a} has {goals} and wants it.',
    'A record chase: {a} needs {left|~goal} to become the club\'s all-time top scorer.',
    '{goals|Goal} so far. {left|Goal} more and {a} passes {rec} at the top of the club\'s list.',
  ],
  // a, goals
  'record.holder': [
    '{a} is the club\'s all-time top scorer with {goals}, and every new goal moves the bar higher.',
    'The club scoring record belongs to {a}: {goals} and counting.',
    '{goals|Goal} for the club. {a} owns the record and keeps rewriting it.',
    '{a} set the club scoring record and has no plans to stop: {goals} so far.',
  ],
  // a, goals
  'goals.top': [
    '{a} scored {goals} last season and has come back hungrier.',
    'Last season\'s top scorer {a} ({goals}) has set himself a bigger number this time. He will not say what.',
    '{goals|Goal} last season, and {a} has spent the summer working on his weaker foot.',
    '{a} wants to beat his {goals} from last season. The goalkeepers in training are already suffering.',
    'The goals will have to come from somewhere, and {a} ({goals} last season) is volunteering.',
  ],
  // a: scorer, b: provider, goals, assists
  'duo': [
    '{b} made, {a} scored. The partnership was the heartbeat of last season.',
    '{a} ({goals|goal}) and {b} ({assists|assist}) seem to share a brain. The coaches want more of it.',
    'Every great side has a duo. Last season ours was {b} to {a}, again and again.',
    '{b} supplies, {a} finishes. They have spent the summer working on new routines together.',
    'The understanding between {b} and {a} is the kind you cannot coach. Long may it last.',
    '{b} laid on {assists}. {a} scored {goals}. They will want more of both.',
  ],
  // a, b, goalsA, goalsB
  'pens': [
    'Penalty duty is a friendly debate between {a} and {b}. Friendly, for now.',
    '{a} and {b} were split by {gap|~goal} last season, and both want the penalties.',
    'Who takes the penalties? {a} says him. {b} says him. The coaches say practise.',
    'The penalty spot is contested ground: {a} and {b} both want first go.',
    '{a} and {b} have a running bet on who scores more this season. Penalties count, apparently.',
  ],
  // a
  'pots': [
    '{a}, last season\'s player of the season, has come back as if he has won nothing.',
    'The trophy for player of the season is on {a}\'s mantelpiece. He would like a second.',
    '{a} wears last season\'s award lightly. The others are trying to take it off him.',
    'Last season was {a}\'s. He has spent the summer making sure this one is too.',
    'Player of the season {a} was back at training before most of the squad had unpacked.',
  ],
  // a, rank
  'ballon': [
    '{a} came {rank|ord} in the Ballon d\'Or. The dressing room has not let him forget it.',
    'The world noticed {a}: {rank|ord} in the Ballon d\'Or. He wants to go higher.',
    '{a} came back from the Ballon d\'Or gala and went straight to training. {rank|Ord} is not enough.',
    'A Ballon d\'Or podium for {a}. The young players ask him about it; he changes the subject.',
    'The dressing room calls {a} the {rank|ord} best player in the world, mostly to wind him up. He takes it well.',
  ],
  // a, apps
  'ever': [
    '{a} played {apps} times last season, more than anyone in the squad. His body asked for a rest; he said no.',
    'Nobody in the squad played more than {a} last season ({apps} games). The physios call him indestructible.',
    '{apps} appearances last season. {a} is the coaches\' first name on the sheet for a reason.',
    '{a} never seems to tire: {apps} games last season and he still wanted more.',
    'The physios had to ban {a} from extra sessions. He played {apps} times last season and asked for more.',
  ],
  // a, goals, apps
  'supersub': [
    '{a} scored {goals|goal} from the bench last season. He would like to start; the coaches like him where he is.',
    'The super-sub: {a} keeps changing games when he comes on. {goals|Goal} last season.',
    '{a} has made the substitute\'s role his own. The opposition groans when he warms up.',
    'Bring on {a}, the fans sing. {goals|Goal} last season says they are right.',
    'Some players sulk on the bench. {a} sharpens his boots: {goals|goal} as a substitute last season.',
  ],
  // a, avg
  'form.hot': [
    'Nobody in the squad played better last season than {a}, who averaged {avg}. He wants to do it again.',
    '{a} averaged {avg} last season, the best in the squad. The bar is set.',
    'The most consistent man in the squad: {a}, {avg} a game last season.',
    'Week in, week out, {a} delivered: {avg} on average. The coaches want that again.',
    'The coaches show clips of {a} to the young players. Last season he averaged {avg}, without a bad month.',
  ],
  // a, b, land, nat
  'compat.pair': [
    '{a} and {b} have been inseparable since day one. Two {nat} voices in a busy dressing room.',
    'The {nat} connection: {a} has been showing {b} the best places to eat.',
    '{a} and {b} share a language, a car to training and, the coaches hope, a telepathy.',
    'Two from {land}: {a} and {b} have found each other, and the settling in has been easy.',
    '{b} arrived knowing nobody except {a}. The {nat} pair now sit together everywhere.',
    'A little corner of {land} in the dressing room: {a} and {b}.',
  ],
  // a, b, land, nat (both established)
  'compat.old': [
    '{a} and {b} keep the {nat} flag flying in the dressing room.',
    'Two from {land}, and two of the loudest laughs at the training ground: {a} and {b}.',
    '{a} and {b} have built the {nat} corner of the dressing room. Others are welcome, sometimes.',
    'The {nat} pair, {a} and {b}, organise the squad meals. Expect a lot of {land} on the menu.',
    '{a} and {b} have shared a lift to training since they met. The {nat} radio station is non-negotiable.',
  ],
  // a, b, c, n, land, nat
  'compat.group': [
    '{n|~player} from {land}, led by {a}. The {nat} contingent has its own table at lunch.',
    'The {nat} corner is the busiest in the dressing room: {a}, {b} and company.',
    'With {n|~player} from {land}, the dressing room has a second language. {a} is the translator.',
    '{a}, {b}, {c}: the {nat} contingent has settled in quickly, and loudly.',
    '{n|~player} from {land} in one squad. {a} and {b} have started a card school.',
  ],
  // a, b, c, n
  'compat.home': [
    'The home-grown core: {n|~player} from England, with {a} at its heart.',
    '{a}, {b} and the other English lads set the tone in the dressing room.',
    'There is an English spine to this squad: {n|~player}, led by {a}.',
    '{n|~player} from England, and {a} is the loudest of them. The music in the gym is his choice.',
    'The English lads, led by {a} and {b}, have taken charge of the dressing room playlist.',
  ],
  // a, land
  'lone': [
    '{a} is the only player from {land} in the squad, and wears it proudly.',
    '{a} flies the flag for {land}. His team-mates have learned a few words already.',
    'A long way from {land}, {a} has made the dressing room his second home.',
    '{a}, the lone voice from {land}, has the whole squad trying his recipes.',
    'Nobody else in the squad is from {land}, so {a} has taught them all the national anthem.',
  ],
  // a: star
  'style.star': [
    'Everything runs through {a} again. He has asked for the ball more, not less.',
    '{a} is the sun the team orbits around. The others have accepted it, mostly.',
    'The system is built on {a}. He trained alone in the summer, by choice.',
    '{a} is in a good mood, and when {a} is in a good mood, this team flies.',
    'The coaches built the team around {a} and he has responded by getting fitter. Lucky them.',
    'All eyes on {a} again. He seems to enjoy it more every year.',
  ],
  // a, b (defenders or keeper)
  'style.bus': [
    'The back line, led by {a} and {b}, has started having its own team dinners. The forwards are not invited.',
    'Parking the bus suits {a} and {b}. They spent the summer drilling the offside line.',
    '{a} and {b} compete over clean sheets the way strikers compete over goals.',
    'The defence is a unit: {a} organises, {b} cleans up. Opponents will hate it.',
    'Hours of shape work, and {a} and {b} loved every minute. The forwards sneaked off early.',
  ],
  // a, b (midfielders)
  'style.tiki': [
    '{a} and {b} have been playing rondos until it gets dark. The ball rarely touches the ground.',
    'The midfield telepathy is real: {a} knows where {b} is without looking.',
    '{a} and {b} pass the ball the way other people breathe. The coaches just watch.',
    'Pass, move, repeat. {a} and {b} could do it blindfolded, and in one drill they did.',
    'In the rondo, nobody gets the ball off {a} and {b}. The coaches have stopped trying.',
  ],
  // a: hardest worker, b: oldest
  'style.press': [
    'The fitness coach has the squad running hills at dawn. {a} was out in front, every time.',
    'Pre-season was brutal and {a} loved it. The others are still catching their breath.',
    'Gegenpressing needs lungs, and {a}\'s are apparently made of something else.',
    'Even {b} kept up with the pressing drills this summer. The fitness coach is taking the credit.',
    'The press starts with {a}, who has been chasing down the physios for fun.',
  ],
  // a, b, n
  'originals': [
    'Only {a} and {b} remain from the opening draft. They remember how it all started.',
    '{a} and {b}: the last of the originals. They tell the new faces what the first summer was like.',
    'Of the first XI ever picked, {n|~player} remain. {a} is the one who keeps the old team photo.',
    '{n|~player} from the very first draft are still here, {a} and {b} among them.',
    '{a} and {b} were there on day one. The newer faces call them the founding fathers.',
  ],
  // a
  'originals.last': [
    '{a} is the last of the originals, the only one left from the opening draft.',
    'Everybody else from that first draft has gone. {a} is still here, still starting.',
    'One survivor from the first ever squad: {a}. He has the shirt from that first season framed.',
    '{a} has seen every re-draft come and go. The last original, and proud of it.',
    'The first squad is a memory now, except for {a}. He still sits in the same seat on the bus.',
  ],
  // a, home, slot
  'offpos': [
    '{a}, a natural {home}, has been asked to play {slot}. He is learning fast.',
    'The coaches have moved {a} from {home} to {slot}. Early signs are promising, he says.',
    'A new role for {a}: a {home} by trade, he is spending extra hours learning {slot}.',
    '{a} has never played {slot} before. He is treating it as a new adventure.',
    'A {home} playing {slot}? {a} has heard the jokes, and has been answering them in training.',
  ],
  // avg, a: youngest, b: oldest
  'age.avg': [
    'The squad\'s average age is {avg}. {a} brings it down, {b} brings it back up.',
    'An average age of {avg}: somewhere between {a}\'s energy and {b}\'s experience.',
    'Youth and experience in one dressing room: average age {avg}, from {a} to {b}.',
    'At an average of {avg}, this squad has a bit of everything, from {a} to {b}.',
    'Average age {avg}. {a} is the youngest and gets the jokes; {b} is the oldest and tells them.',
  ],
  // a: youngest, b: oldest, ageA, ageB, gap
  'young.old': [
    '{gap|Year} separate the youngest, {a}, from the oldest, {b}. They share a love of the same music, somehow.',
    '{a} is {ageA}, {b} is {ageB}. One brings the energy, the other brings the stories.',
    'The baby of the squad is {a}, {ageA}. The elder statesman is {b}, {ageB}.',
    '{a} ({ageA}) and {b} ({ageB}) room together on away trips. One brings the playlist, the other the early nights.',
    'Youngest and oldest: {a} at {ageA}, {b} at {ageB}. The dressing room has a generation gap and loves it.',
  ],
  // a, b, area (first season)
  'twostars': [
    'Two big names in one {area}: {a} and {b}. The coaches say there is room for both. We will see.',
    '{a} and {b} are the stars of the {area}. Whether they shine together is the question of the summer.',
    'The {area} has {a} and {b}. That is either a dream or a headache, and probably both.',
    '{a} and {b} in the same {area}: plenty of quality, and two very big personalities.',
    'The coaches have two stars for one {area}: {a} and {b}. They have been told to share the ball, and the headlines.',
  ],
  // a, ovr
  'best': [
    '{a}, rated {ovr}, is the best player in the squad. The others raise their game around him.',
    'The squad\'s top name is {a}. He has been modest about it, which helps.',
    '{a} is the player opponents will plan for. At {ovr}, he is the class of this squad.',
    'Rated {ovr}, {a} is the standard everyone in training measures himself against.',
    'Every drill, every match, the others look at {a}. At {ovr}, he is the one to beat in training.',
  ],
  // a: newcomer
  'new.face': [
    '{a} is the new face in the dressing room. Initiation song done; it went better than expected.',
    'New arrival {a} has been made to feel at home. He brought cake to his first session, which helped.',
    '{a} arrived this summer and the squad has taken to him quickly.',
    'The newest man in the dressing room, {a}, was given the worst seat on the bus. Tradition.',
    '{a} is still learning everyone\'s names, but the dressing room learned his on day one.',
  ],
};

// ─────────────────────────── Rendering ───────────────────────────

type Vars = Record<string, string | number | undefined>;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

function plural(noun: string): string {
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(ch|sh|s|x)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

function format(v: string | number, m?: string): string | null {
  if (m === undefined) return String(v);
  if (m === 'Cap') return cap(String(v));
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (m === 'ord' || m === 'Ord') return m === 'Ord' ? cap(ord(n)) : ord(n);
  if (m === 'w' || m === 'W') {
    const w = n >= 0 && n <= 10 ? WORDS[n] : String(n);
    return m === 'W' ? cap(w) : w;
  }
  const words = m.startsWith('~');
  let noun = words ? m.slice(1) : m;
  const upper = noun[0] !== noun[0].toLowerCase();
  noun = noun.toLowerCase();
  const out = `${words && n >= 0 && n <= 10 ? WORDS[n] : n} ${n === 1 ? noun : plural(noun)}`;
  return upper ? cap(out) : out;
}

function render(tpl: string, vars: Vars, rng: Rng): string | null {
  // Choices first ([a|b], no nesting), then facts.
  const chosen = tpl.replace(/\[([^\]]*)\]/g, (_, body: string) => {
    const opts = body.split('|');
    return opts[Math.floor(rng() * opts.length)];
  });
  let missing = false;
  const out = chosen.replace(/\{(\w+)(?:\|([~\w]+))?\}/g, (_, k: string, m?: string) => {
    const v = vars[k];
    const f = v === undefined || v === '' ? null : format(v, m);
    if (f === null) missing = true;
    return f ?? '';
  });
  return missing ? null : cap(out);
}

// ─────────────────────────── The squad as facts ───────────────────────────

/** Nationality adjectives; a nation missing here is only named, never described. */
const NAT: Record<string, string> = {
  Spain: 'Spanish', France: 'French', Brazil: 'Brazilian', Italy: 'Italian', Germany: 'German', England: 'English',
  Argentina: 'Argentine', Portugal: 'Portuguese', Netherlands: 'Dutch', Uruguay: 'Uruguayan', Belgium: 'Belgian',
  Chile: 'Chilean', Colombia: 'Colombian', Serbia: 'Serbian', Turkey: 'Turkish', Senegal: 'Senegalese', Russia: 'Russian',
  Croatia: 'Croatian', "Côte d'Ivoire": 'Ivorian', Denmark: 'Danish', Switzerland: 'Swiss', Austria: 'Austrian',
  Sweden: 'Swedish', Scotland: 'Scottish', Nigeria: 'Nigerian', Poland: 'Polish', Morocco: 'Moroccan',
  'Republic of Ireland': 'Irish', Mexico: 'Mexican', Algeria: 'Algerian', 'Czech Republic': 'Czech',
  'United States': 'American', Cameroon: 'Cameroonian', Ghana: 'Ghanaian', Ukraine: 'Ukrainian', Greece: 'Greek',
  Mali: 'Malian', Paraguay: 'Paraguayan', Norway: 'Norwegian', Japan: 'Japanese', Romania: 'Romanian', Wales: 'Welsh',
  'Bosnia and Herzegovina': 'Bosnian', Venezuela: 'Venezuelan', Slovakia: 'Slovak', Slovenia: 'Slovenian',
  Ecuador: 'Ecuadorian', Tunisia: 'Tunisian', 'Korea Republic': 'South Korean', 'South Africa': 'South African',
  Albania: 'Albanian', Hungary: 'Hungarian', Australia: 'Australian', Peru: 'Peruvian', Finland: 'Finnish',
  'Northern Ireland': 'Northern Irish', Egypt: 'Egyptian', Iceland: 'Icelandic', 'Costa Rica': 'Costa Rican',
  Bulgaria: 'Bulgarian', Israel: 'Israeli', Gabon: 'Gabonese', Guinea: 'Guinean', Togo: 'Togolese',
  Montenegro: 'Montenegrin', Kosovo: 'Kosovan', Jamaica: 'Jamaican', Canada: 'Canadian', Iran: 'Iranian',
  'Burkina Faso': 'Burkinabe', 'Cape Verde Islands': 'Cape Verdean', 'Congo DR': 'Congolese', 'New Zealand': 'New Zealander',
  Georgia: 'Georgian', Armenia: 'Armenian', Belarus: 'Belarusian', Lithuania: 'Lithuanian', Latvia: 'Latvian',
  Estonia: 'Estonian', Cyprus: 'Cypriot', Honduras: 'Honduran', Panama: 'Panamanian', Bolivia: 'Bolivian',
  Kenya: 'Kenyan', Zambia: 'Zambian', Zimbabwe: 'Zimbabwean', Angola: 'Angolan', Benin: 'Beninese',
  'North Macedonia': 'Macedonian', 'FYR Macedonia': 'Macedonian', China: 'Chinese', 'China PR': 'Chinese',
};
/** How a nation reads in a sentence. */
const LAND: Record<string, string> = {
  Netherlands: 'the Netherlands', 'United States': 'the United States', 'Czech Republic': 'the Czech Republic',
  'Republic of Ireland': 'Ireland', 'Congo DR': 'DR Congo', 'Korea Republic': 'South Korea',
  'Cape Verde Islands': 'Cape Verde', 'Central African Republic': 'the Central African Republic',
  'Dominican Republic': 'the Dominican Republic', Philippines: 'the Philippines', 'China PR': 'China',
  'FYR Macedonia': 'North Macedonia',
};

/** A position as a place to fight for. */
const ROLE: Record<Position, string> = {
  GK: 'the No. 1 jersey', CB: 'a centre-back berth', LB: 'the left-back spot', RB: 'the right-back spot',
  LWB: 'the left wing-back role', RWB: 'the right wing-back role', CDM: 'the holding role', CM: 'a central midfield berth',
  CAM: 'the No. 10 role', LM: 'the left-midfield spot', RM: 'the right-midfield spot', LW: 'the left-wing spot',
  RW: 'the right-wing spot', CF: 'the No. 9 shirt', ST: 'the No. 9 shirt',
};
/** A position as a player is described. */
const POS_NAME: Record<Position, string> = {
  GK: 'goalkeeper', CB: 'centre-back', LB: 'left-back', RB: 'right-back', LWB: 'left wing-back', RWB: 'right wing-back',
  CDM: 'holding midfielder', CM: 'central midfielder', CAM: 'playmaker', LM: 'left midfielder', RM: 'right midfielder',
  LW: 'left winger', RW: 'right winger', CF: 'centre-forward', ST: 'striker',
};
/** Positions close enough to compete for one place. */
const GROUP: Record<Position, string> = {
  GK: 'GK', CB: 'CB', LB: 'FB', RB: 'FB', LWB: 'FB', RWB: 'FB', CDM: 'CM', CM: 'CM', CAM: 'AM',
  LM: 'W', RM: 'W', LW: 'W', RW: 'W', CF: 'ST', ST: 'ST',
};
const AREA_NAME: Record<Area, string> = { GK: 'goalmouth', DEF: 'defence', MID: 'midfield', ATT: 'attack' };

interface P {
  id: number;
  name: string;
  nation: string;
  age: number;
  ovr: number;
  pot: number;
  /** the position he plays now: his XI slot, or his home position */
  pos: Position;
  /** the position he was drafted for, or his main one */
  home: Position;
  area: Area;
  xi: boolean;
  /** seasons in a row he has been at the club, up to last season */
  served: number;
  /** at the club, league and cups, this career */
  apps: number;
  goals: number;
  assists: number;
  last?: PlayerSeasonStats;
  dev?: DevChange;
}

interface Cand {
  kind: string;
  /** one note per group */
  group: string;
  w: number;
  players: number[];
  vars: Vars;
}

function clubSeason(state: GameState, h: SeasonHistory, club: number) {
  const u = h.byUser?.[club];
  if (u) return { stats: [...u.userStats], cups: [...u.userCupStats], ratings: u.ratings, pots: u.pots };
  if (club === state.user) return { stats: [...h.userStats], cups: [...h.userCupStats], ratings: h.ratings, pots: h.pots };
  return null;
}

function addStats(into: Map<number, PlayerSeasonStats>, list: PlayerSeasonStats[]): void {
  for (const s of list) {
    const m = into.get(s.id);
    if (!m) into.set(s.id, { ...s });
    else {
      m.apps += s.apps;
      m.starts += s.starts;
      m.goals += s.goals;
      m.assists += s.assists;
      m.ratingSum += s.ratingSum;
    }
  }
}

const avgOf = (s: PlayerSeasonStats | undefined) => (s && s.apps ? s.ratingSum / s.apps : undefined);
const by = <T>(key: (x: T) => number) => (a: T, b: T) => key(b) - key(a);

// ─────────────────────────── The notes ───────────────────────────

/**
 * Two to four short dressing-room notes about a club's squad, for the summer
 * screen: rivalries, leadership, mentors, growth, milestones and more. Pure
 * and deterministic for a given state. In the first summer (no history yet)
 * they come from the drafted squad alone.
 */
export function squadNotes(state: GameState, data: GameData, club: number): SquadNote[] {
  return notes(state, data, club, false);
}

/** The first summer's notes, from the drafted squad alone (squadNotes tells these whenever there is no history yet). */
export function firstSeasonNotes(state: GameState, data: GameData, club: number): SquadNote[] {
  return notes(state, data, club, true);
}

function notes(state: GameState, data: GameData, club: number, fresh: boolean): SquadNote[] {
  const c = state.clubs[club];
  if (!c) return [];
  const rng = stream(state.seed, 'squad', state.season, club);
  const draft = state.mode === 'draft' ? draftOf(state, club) : undefined;
  const slots = FORMATIONS[c.formation];
  const devReport = fresh ? [] : club === state.user ? state.devReport : state.mp?.views[club]?.devReport ?? [];
  const dev = new Map(devReport.map((r) => [r.player, r]));

  // Seasons played at the club (the user's, or a room manager's).
  const seasons = (fresh ? [] : state.history)
    .filter((h) => h.season < state.season)
    .map((h) => ({ h, s: clubSeason(state, h, club) }))
    .filter((x): x is { h: SeasonHistory; s: NonNullable<ReturnType<typeof clubSeason>> } => !!x.s);
  const lastSeason = seasons[seasons.length - 1];
  const lastStats = new Map<number, PlayerSeasonStats>();
  if (lastSeason) addStats(lastStats, [...lastSeason.s.stats, ...lastSeason.s.cups]);
  const totals = new Map<number, PlayerSeasonStats>();
  for (const { s } of seasons) addStats(totals, [...s.stats, ...s.cups]);
  const inSeason = (x: (typeof seasons)[number], id: number) =>
    x.s.ratings?.some(([pid]) => pid === id) ?? [...x.s.stats, ...x.s.cups].some((st) => st.id === id);

  const ids = c.squad.filter((id) => state.players[id] && !state.players[id].retired && data.names[id]);
  const squad: P[] = ids.map((id) => {
    const p = state.players[id];
    const natural = parsePositions(p.pos);
    const home = draft?.home?.[id] ?? natural[0] ?? 'CM';
    const xiAt = c.xi.indexOf(id);
    const pos = xiAt >= 0 && slots[xiAt] ? slots[xiAt] : home;
    let served = 0;
    for (let k = seasons.length - 1; k >= 0 && inSeason(seasons[k], id); k--) served++;
    const t = totals.get(id);
    return {
      id, name: data.names[id][0], nation: data.names[id][1], age: p.age, ovr: p.ovr, pot: p.pot, pos, home,
      area: AREA[pos], xi: xiAt >= 0, served, apps: t?.apps ?? 0, goals: t?.goals ?? 0, assists: t?.assists ?? 0,
      last: lastStats.get(id), dev: dev.get(id),
    };
  });
  if (squad.length < 2) return [];
  const byId = new Map(squad.map((p) => [p.id, p]));
  const first = !lastSeason;
  const cands: Cand[] = [];
  const add = (kind: string, w: number, players: P[], vars: Vars = {}, group = kind.split('.')[0]) => {
    const named: Vars = {};
    players.forEach((p, i) => (named['abc'[i]] = p.name));
    cands.push({ kind, group, w, players: players.map((p) => p.id), vars: { ...named, ...vars } });
  };
  const pick = <T>(list: T[]): T | undefined => (list.length ? list[Math.floor(rng() * list.length)] : undefined);
  const ranked = squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id);
  const isNew = (p: P) => !first && p.served === 0;

  // ── Competition for places ──
  const subs = squad.filter((p) => !p.xi);
  const starters = squad.filter((p) => p.xi);
  const rivals: [P, P][] = [];
  for (const s of subs) for (const x of starters) if (GROUP[s.home] === GROUP[x.pos]) rivals.push([s, x]);
  if (!starters.length || !subs.length) {
    // A squad without a set XI: any two in the same group.
    for (let i = 0; i < squad.length; i++) for (let j = i + 1; j < squad.length; j++) {
      if (GROUP[squad[i].home] === GROUP[squad[j].home]) rivals.push([squad[j], squad[i]]);
    }
  }
  const formRival = rivals.filter(([s, x]) => {
    const as = avgOf(s.last);
    const ax = avgOf(x.last);
    return as !== undefined && s.last!.apps >= 8 && (ax === undefined || as >= ax - 0.05) && s.ovr >= x.ovr - 6;
  });
  const fr = pick(formRival);
  if (fr) add('rival.form', 6, fr, { role: ROLE[fr[1].pos], avgA: avgOf(fr[0].last)!.toFixed(2), avgB: avgOf(fr[1].last)?.toFixed(2) }, 'rival');
  const newRival = rivals.filter(([s, x]) => isNew(s) !== isNew(x)).map(([s, x]) => (isNew(s) ? [s, x] : [x, s]) as [P, P]);
  const nr = pick(newRival);
  if (nr) add('rival.newcomer', 5, nr, { role: ROLE[nr[1].pos] }, 'rival');
  const even = rivals.filter(([s, x]) => Math.abs(s.ovr - x.ovr) <= 3);
  const ev = pick(even);
  if (ev) add('rival.even', first ? 6 : 4, ev, { role: ROLE[ev[1].pos] }, 'rival');

  // Partners: two starters in the same group.
  const pairs: [P, P][] = [];
  for (let i = 0; i < starters.length; i++) for (let j = i + 1; j < starters.length; j++) {
    const [a, b] = [starters[i], starters[j]];
    if (GROUP[a.pos] === GROUP[b.pos] && a.area !== 'GK') pairs.push([a, b]);
  }
  const pr = pick(pairs);
  if (pr) add('partners', 2, pr, { area: AREA_NAME[pr[0].area] });

  // The two best players, level at the top.
  if (ranked.length >= 2 && ranked[0].ovr - ranked[1].ovr <= 1) add('topdog', 3, [ranked[0], ranked[1]], {}, 'top');
  else add('best', 1, [ranked[0]], { ovr: ranked[0].ovr }, 'top');

  // ── Leadership ──
  const lead = (p: P) => p.served * 3 + p.apps / 25 + Math.min(p.age, 33) / 3 + p.ovr / 8;
  const leaders = squad.filter((p) => p.age >= 24).sort((a, b) => lead(b) - lead(a) || a.id - b.id);
  const cpt = leaders[0];
  if (cpt) {
    if (first) add('captain.first', 4, [cpt], { age: cpt.age, ovr: cpt.ovr }, 'captain');
    else if (cpt.served > 0) add('captain', 3, [cpt], { seasons: cpt.served, apps: cpt.apps || undefined, age: cpt.age }, 'captain');
    const second = leaders[1];
    if (second && lead(cpt) - lead(second) < 1.5) add('leader.contest', 3, [cpt, second], {}, 'captain');
  }

  // ── Clashes: rare, between two strong personalities ──
  const top5 = ranked.slice(0, 5);
  const clashes: [P, P][] = [];
  for (let i = 0; i < top5.length; i++) for (let j = i + 1; j < top5.length; j++) {
    const [a, b] = [top5[i], top5[j]];
    if (a.area === b.area && a.area !== 'GK' && a.age >= 23 && b.age >= 23) clashes.push([a, b]);
  }
  const cl = pick(clashes);
  if (cl) add('clash', first ? 0.6 : 1.2, cl, { area: AREA_NAME[cl[0].area] });
  const star = c.star !== undefined ? byId.get(c.star) : undefined;
  if (c.style === 'star' && star) {
    const other = ranked.find((p) => p !== star && p.area !== 'GK' && p.area !== 'DEF' && p.ovr >= star.ovr - 4);
    if (other) add('clash.star', 1.6, [star, other], {}, 'clash');
  }

  // ── Mentors ──
  const vets = squad.filter((p) => p.age >= 31);
  const kids = squad.filter((p) => p.age <= 21);
  const same: [P, P][] = [];
  const cross: [P, P][] = [];
  for (const v of vets) for (const k of kids) (v.area === k.area ? same : cross).push([v, k]);
  const mt = pick(same);
  if (mt) add('mentor', 4, mt, { ageA: mt[0].age, ageB: mt[1].age, gap: mt[0].age - mt[1].age }, 'mentor');
  else {
    const mc = pick(cross);
    if (mc) add('mentor.cross', 2, mc, { ageA: mc[0].age, ageB: mc[1].age }, 'mentor');
  }

  // ── Growth ──
  const grown = squad.filter((p) => p.dev).sort((a, b) => b.dev!.to - b.dev!.from - (a.dev!.to - a.dev!.from) || a.id - b.id);
  const g = grown[0];
  if (g && g.dev!.to - g.dev!.from >= 2) {
    const gain = g.dev!.to - g.dev!.from;
    if (g.age <= 22) add('growth.young', 4, [g], { gain, age: g.age, to: g.dev!.to }, 'growth');
    else add('growth.top', 4, [g], { gain, from: g.dev!.from, to: g.dev!.to }, 'growth');
  }
  const d = grown[grown.length - 1];
  if (d && d !== g && d.dev!.to - d.dev!.from <= -2) add('growth.dip', 2, [d], { drop: d.dev!.from - d.dev!.to, to: d.dev!.to }, 'dip');
  const tip = squad.filter((p) => p.age <= 20 && p.pot - p.ovr >= 6).sort(by((p) => p.pot))[0];
  if (tip) add('tipped', 3, [tip], { age: tip.age, pot: tip.pot }, 'young');
  const prime = pick(squad.filter((p) => (p.age === 26 || p.age === 27) && p.ovr >= ranked[Math.floor(ranked.length / 2)].ovr));
  if (prime) add('peak', 1.5, [prime], { age: prime.age, ovr: prime.ovr }, 'age');
  const old = squad.filter((p) => p.age >= 33).sort(by((p) => p.age))[0];
  if (old) add('twilight', 2.5, [old], { age: old.age }, 'age');

  // ── Milestones and records (history) ──
  if (!first) {
    const legend = squad.slice().sort(by((p) => p.apps))[0];
    if (legend && legend.served >= 2 && legend.apps >= 60) add('legend', 3, [legend], { apps: legend.apps, seasons: legend.served }, 'legend');
    const appsNear = squad.map((p) => ({ p, next: Math.floor(p.apps / 50 + 1) * 50 })).filter((x) => x.p.apps >= 30 && x.next - x.p.apps <= 12);
    const am = pick(appsNear);
    if (am) add('milestone.apps', 3.5, [am.p], { next: am.next, left: am.next - am.p.apps }, 'milestone');
    const goalsNear = squad.map((p) => ({ p, next: Math.floor(p.goals / 25 + 1) * 25 })).filter((x) => x.p.goals >= 10 && x.next - x.p.goals <= 6);
    const gm = pick(goalsNear);
    if (gm) add('milestone.goals', 3.5, [gm.p], { next: gm.next, left: gm.next - gm.p.goals, goals: gm.p.goals }, 'milestone');
    // A club record means something only at a club founded this career.
    if (draft) {
      const holder = [...totals.values()].sort((a, b) => b.goals - a.goals || a.id - b.id)[0];
      if (holder && holder.goals >= 15) {
        const mine = byId.get(holder.id);
        if (mine) add('record.holder', 2.5, [mine], { goals: mine.goals }, 'record');
        else {
          const chaser = squad.slice().sort(by((p) => p.goals))[0];
          const left = holder.goals - chaser.goals + 1;
          if (chaser.goals >= 8 && left <= 20) add('record.chase', 4.5, [chaser], { rec: data.names[holder.id]?.[0], left, goals: chaser.goals }, 'record');
        }
      }
    }
    // Last season's scorers, providers and award winners.
    const withLast = squad.filter((p) => p.last);
    const scorers = withLast.slice().sort((a, b) => b.last!.goals - a.last!.goals || a.id - b.id);
    const providers = withLast.slice().sort((a, b) => b.last!.assists - a.last!.assists || a.id - b.id);
    const ts = scorers[0];
    if (ts && ts.last!.goals >= 8) add('goals.top', 2.5, [ts], { goals: ts.last!.goals }, 'goals');
    const tp = providers[0];
    if (ts && tp && ts !== tp && ts.last!.goals >= 6 && tp.last!.assists >= 5) {
      add('duo', 3, [ts, tp], { goals: ts.last!.goals, assists: tp.last!.assists }, 'goals');
    }
    const s2 = scorers[1];
    if (ts && s2 && ts.last!.goals >= 6 && ts.last!.goals - s2.last!.goals <= 3) {
      add('pens', 2, [ts, s2], { gap: ts.last!.goals - s2.last!.goals || undefined }, 'pens');
    }
    const pots = lastSeason.s.pots !== undefined ? byId.get(lastSeason.s.pots) : undefined;
    if (pots) add('pots', 2.5, [pots], {}, 'award');
    const podium = lastSeason.h.ballon?.findIndex((b) => b.club === club && byId.has(b.player)) ?? -1;
    if (podium >= 0) add('ballon', 5, [byId.get(lastSeason.h.ballon![podium].player)!], { rank: podium + 1 }, 'award');
    const ever = withLast.slice().sort((a, b) => b.last!.apps - a.last!.apps || a.id - b.id)[0];
    if (ever && ever.last!.apps >= 40) add('ever', 1.5, [ever], { apps: ever.last!.apps });
    const sub = withLast.filter((p) => p.last!.apps >= 10 && p.last!.starts * 2 <= p.last!.apps && p.last!.goals >= 3).sort(by((p) => p.last!.goals))[0];
    if (sub) add('supersub', 3, [sub], { goals: sub.last!.goals, apps: sub.last!.apps });
    const hot = withLast.filter((p) => p.last!.apps >= 15).sort(by((p) => avgOf(p.last)!))[0];
    if (hot) add('form.hot', 1.5, [hot], { avg: avgOf(hot.last)!.toFixed(2) }, 'form');
    // The players picked in the opening draft who are still here.
    if (draft && state.season >= 2) {
      const originals = squad.filter((p) => draft.picks.some((pk) => pk.season === 0 && pk.player === p.id) && p.served === state.season);
      if (originals.length === 1) add('originals.last', 3, originals, {}, 'originals');
      else if (originals.length >= 2 && originals.length <= 4) add('originals', 2.5, shuffle(rng, originals).slice(0, 2), { n: originals.length }, 'originals');
    }
    const fresh = pick(squad.filter(isNew));
    if (fresh) add('new.face', 1.2, [fresh], {}, 'new');
  }

  // ── Out of position (draft): a starter moved away from the position he was drafted for ──
  if (draft) {
    const off = pick(starters.filter((p) => positionFit([p.home], p.pos) < 0.9));
    if (off) add('offpos', 2, [off], { home: POS_NAME[off.home], slot: POS_NAME[off.pos] });
  }

  // ── Nationality ──
  const nations = new Map<string, P[]>();
  for (const p of squad) nations.set(p.nation, [...(nations.get(p.nation) ?? []), p]);
  const groups = [...nations.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
  const [bigNation, big] = groups[0];
  const land = (n: string) => LAND[n] ?? n;
  if (big.length >= 3) {
    const members = big.slice().sort(by((p) => p.ovr));
    if (bigNation === 'England') add('compat.home', 2, members.slice(0, 3), { n: big.length }, 'nation');
    else add('compat.group', 3, members.slice(0, 3), { n: big.length, land: land(bigNation), nat: NAT[bigNation] }, 'nation');
  }
  const duos = groups.filter(([n, list]) => list.length === 2 && n !== 'England');
  const du = pick(duos);
  if (du) {
    const [a, b] = du[1];
    const fresh = isNew(a) || isNew(b) || first;
    const pair = isNew(a) && !isNew(b) ? [b, a] : [a, b];
    add(fresh ? 'compat.pair' : 'compat.old', 2.5, pair, { land: land(du[0]), nat: NAT[du[0]] }, 'nation');
  }
  const lone = pick(groups.filter(([n, list]) => list.length === 1 && !['England', 'Spain', 'France', 'Germany', 'Italy', 'Brazil'].includes(n)));
  if (lone) add('lone', 0.8, lone[1], { land: land(lone[0]) }, 'nation');

  // ── The style's flavour ──
  const inArea = (...areas: Area[]) => ranked.filter((p) => areas.includes(p.area));
  if (c.style === 'star' && (star ?? ranked[0])) add('style.star', 2, [star ?? ranked[0]], {}, 'style');
  if (c.style === 'bus' && inArea('DEF', 'GK').length >= 2) add('style.bus', 2, inArea('DEF', 'GK').slice(0, 2), {}, 'style');
  if (c.style === 'tiki' && inArea('MID').length >= 2) add('style.tiki', 2, shuffle(rng, inArea('MID').slice(0, 3)).slice(0, 2), {}, 'style');
  if (c.style === 'press') {
    const runner = pick(squad.filter((p) => p.age <= 27 && p.area !== 'GK')) ?? ranked[0];
    const eldest = squad.slice().sort(by((p) => p.age))[0];
    add('style.press', 2, eldest !== runner && eldest.age >= 30 ? [runner, eldest] : [runner], {}, 'style');
  }

  // ── The squad as a whole ──
  const byAge = squad.slice().sort((a, b) => a.age - b.age || a.id - b.id);
  const youngest = byAge[0];
  const oldest = byAge[byAge.length - 1];
  const avgAge = squad.reduce((s, p) => s + p.age, 0) / squad.length;
  add('age.avg', first ? 1.5 : 0.6, [youngest, oldest], { avg: avgAge.toFixed(1) }, 'squad');
  if (oldest.age - youngest.age >= 8) {
    add('young.old', first ? 2.5 : 1, [youngest, oldest], { ageA: youngest.age, ageB: oldest.age, gap: oldest.age - youngest.age }, 'squad');
  }
  if (first) {
    const stars: [P, P][] = [];
    for (let i = 0; i < top5.length; i++) for (let j = i + 1; j < top5.length; j++) {
      if (top5[i].area === top5[j].area && top5[i].area !== 'GK' && top5[j].ovr >= 80) stars.push([top5[i], top5[j]]);
    }
    const st = pick(stars);
    if (st) add('twostars', 3, st, { area: AREA_NAME[st[0].area] }, 'clash');
  }

  return choose(state, club, rng, cands);
}

/** Draws the notes by weight, one per group and mostly about different players, and words them. */
function choose(state: GameState, club: number, rng: Rng, cands: Cand[]): SquadNote[] {
  const want = 2 + (rng() < 0.6 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
  const out: SquadNote[] = [];
  const groups = new Set<string>();
  const featured = new Map<number, number>();
  const used = new Map<string, number>();
  let pool = cands.slice();
  for (let pass = 0; pass < 2 && out.length < want; pass++) {
    pool = pool.filter((x) => !groups.has(x.group));
    while (out.length < want) {
      // First pass: nobody appears twice. Second pass: nobody three times.
      const open = pool.filter((x) => !groups.has(x.group) && x.players.every((id) => (featured.get(id) ?? 0) <= pass));
      if (!open.length) break;
      let r = rng() * open.reduce((s, x) => s + x.w, 0);
      let at = 0;
      while (at < open.length - 1 && (r -= open[at].w) > 0) at++;
      const cand = open[at];
      pool = pool.filter((x) => x !== cand);
      const text = word(state, club, rng, cand, used);
      if (!text) continue;
      // The players the wording actually names.
      const named = cand.players.filter((_, i) => text.includes(String(cand.vars['abc'[i]])));
      groups.add(cand.group);
      for (const id of named) featured.set(id, (featured.get(id) ?? 0) + 1);
      out.push({ kind: cand.kind, text, players: named });
    }
  }
  return out;
}

/** A wording for a situation: the bank is dealt in a per-career order, one step on each season. */
function word(state: GameState, club: number, rng: Rng, cand: Cand, used: Map<string, number>): string | null {
  const bank = SQUAD_BANK[cand.kind];
  const order = shuffle(stream(state.seed, 'squad-bank', cand.kind, club), bank.map((_, i) => i));
  const start = state.season + (used.get(cand.kind) ?? 0);
  for (let k = 0; k < order.length; k++) {
    const text = render(bank[order[(start + k) % order.length]], cand.vars, rng);
    if (text && text.length <= MAX_NOTE) {
      used.set(cand.kind, (used.get(cand.kind) ?? 0) + 1);
      return text;
    }
  }
  return null;
}
