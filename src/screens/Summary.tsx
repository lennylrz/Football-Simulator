import { seasonLabel } from '../game/game';
import { Button, Card, ClubBadge } from '../ui/components';
import { useGame } from '../ui/context';
import { ordinal } from './TransferWindow';

export function Summary() {
  const { data, game, quit } = useGame();
  return (
    <Card title="Your five seasons">
      <ul className="space-y-1 text-sm">
        {game.history.map((h) => {
          const pos = h.table.findIndex((r) => r.club === game.user) + 1;
          return (
            <li key={h.season} className="flex items-center gap-2">
              <span className="w-16 text-slate-400">{seasonLabel(h.season)}</span>
              <span className="flex-1 font-semibold">{ordinal(pos)}</span>
              <ClubBadge data={data} club={h.table[0].club} size={20} />
            </li>
          );
        })}
      </ul>
      <Button onClick={quit} className="mt-4 w-full">New run</Button>
    </Card>
  );
}
