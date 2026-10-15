import { useEffect, useRef, useState } from 'react';
import { Button, Card, clubInfo, playerName } from '../ui/components';
import { useGame } from '../ui/context';
import { downloadBlob, drawShareCard, shareOrDownload } from '../ui/shareCard';
import { HallOfFameContent, useCareer } from './HallOfFame';
import { BottomBar } from './TransferWindow';

export function Summary() {
  const { data, game, quit } = useGame();
  const career = useCareer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const club = clubInfo(data, game.user);

  useEffect(() => {
    if (!canvas.current) return;
    drawShareCard(canvas.current, {
      club,
      career,
      name: (id) => playerName(data, id),
      seed: game.seed,
      site: window.location.host,
    });
    setPreview(canvas.current.toDataURL('image/png'));
  }, [club, career, data, game.seed]);

  const fileName = `five-seasons-${club.code.toLowerCase()}.png`;
  const text = career.trebles
    ? `I won the treble with ${club.name}. Can you?`
    : `My five seasons in charge of ${club.name}. Can you do better?`;

  const share = async () => {
    if (!canvas.current) return;
    try {
      const how = await shareOrDownload(canvas.current, fileName, `${text} ${window.location.origin}`);
      setStatus(how === 'downloaded' ? 'Image saved to your downloads.' : null);
    } catch {
      setStatus('Could not create the image.');
    }
  };

  const download = () =>
    canvas.current?.toBlob((b) => {
      if (b) downloadBlob(b, fileName);
    }, 'image/png');

  return (
    <>
      <Card title="Your share card">
        <canvas ref={canvas} className="hidden" />
        {preview && <img src={preview} alt="Run summary card" className="mx-auto w-full max-w-sm rounded-lg ring-1 ring-slate-700" />}
        <div className="mt-3 flex gap-2">
          <Button onClick={share} className="flex-1">Share</Button>
          <Button onClick={download} variant="secondary" className="flex-1">Download</Button>
        </div>
        {status && <p className="mt-2 text-center text-sm text-slate-400">{status}</p>}
      </Card>
      <HallOfFameContent />
      <BottomBar>
        <Button onClick={quit} className="w-full py-3">Start a new run</Button>
      </BottomBar>
    </>
  );
}
