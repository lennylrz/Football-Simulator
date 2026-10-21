// Draws the end-of-run share card (1080x1350, a 4:5 portrait image).
import type { Career, Trophy } from '../game/career';
import type { ClubInfo } from '../game/clubs';
import { eraSeasons, SEASON_YEARS } from '../game/data';

export interface CardInput {
  club: ClubInfo;
  career: Career;
  name: (id: number) => string;
  seed: number;
  site: string;
}

const W = 1080;
const H = 1350;
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
const TROPHY_LABELS: Record<Trophy, string> = { league: 'LEAGUE', fa: 'FA CUP', cl: 'EUROPE' };

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** The glossy split bar of the era: lighter top half, darker bottom half. */
function glossBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, mid: string, low: string, bottom: string) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(0.49, mid);
  g.addColorStop(0.5, low);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(x, y, w, 1);
}

function lightTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#f4f4f4');
  g.addColorStop(0.6, '#dcdcdc');
  g.addColorStop(1, '#c9c9c9');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

export function drawShareCard(canvas: HTMLCanvasElement, input: CardInput): void {
  const { club, career, name } = input;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const pad = 56;

  // Charcoal stage with faint diagonal swooshes.
  const bg = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, H);
  bg.addColorStop(0, '#2c2d30');
  bg.addColorStop(0.6, '#111213');
  bg.addColorStop(1, '#0b0b0c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#fff';
  for (const [x, w] of [[380, 40], [520, 80]]) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w - 700, H); ctx.lineTo(x - 700, H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Club header strip.
  let c = club.primary;
  if (lum(c) > 0.62) c = club.secondary;
  if (lum(c) > 0.62) c = '#1d4f91';
  glossBar(ctx, pad, 60, W - pad * 2, 84, shade(c, 0.3), c, shade(c, -0.28), shade(c, -0.12));
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText(fitText(ctx, club.name, 640), pad + 28, 118);
  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('CAREER SUMMARY', W - pad - 28, 113);
  ctx.textAlign = 'left';
  ctx.shadowColor = 'transparent';

  // White office panel with the headline.
  const t = career.trophies;
  const total = t.league + t.fa + t.cl;
  const treble = career.trebles > 0;
  const og = ctx.createLinearGradient(0, 150, 0, 330);
  if (treble) { og.addColorStop(0, '#fff6c8'); og.addColorStop(0.55, '#f6d65a'); og.addColorStop(1, '#e2b21c'); }
  else { og.addColorStop(0, '#ffffff'); og.addColorStop(0.55, '#f1f1f1'); og.addColorStop(1, '#dcdcdc'); }
  ctx.fillStyle = og;
  ctx.fillRect(pad, 150, W - pad * 2, 180);
  ctx.fillStyle = '#5b5e63';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`FIVE SEASONS · ${eraSeasons()}`, pad + 28, 196);
  ctx.fillStyle = treble ? '#4a2f00' : '#1d1d1d';
  ctx.font = `900 ${treble ? 78 : 64}px ${FONT}`;
  const headline = treble
    ? career.trebles > 1 ? `${career.trebles}× TREBLE WINNERS` : 'TREBLE WINNERS'
    : total === 0 ? 'No trophies. Yet.' : `${total} ${total === 1 ? 'Trophy' : 'Trophies'}`;
  ctx.fillText(fitText(ctx, headline, W - pad * 2 - 56), pad + 28, 274);
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = treble ? '#5a3a00' : '#3b3d41';
  ctx.fillText(`League ${t.league}   ·   FA Cup ${t.fa}   ·   Champions League ${t.cl}`, pad + 28, 312);

  // Season tiles: dark header with the season, light body with the finish.
  const top = 366;
  const gap = 12;
  const bw = (W - pad * 2 - gap * 4) / 5;
  career.seasons.forEach((s, i) => {
    const x = pad + i * (bw + gap);
    const y0 = SEASON_YEARS[s.season];
    glossBar(ctx, x, top, bw, 44, '#5b5d61', '#45474b', '#2f3134', '#232427');
    ctx.fillStyle = '#fff';
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${y0}/${String(y0 + 1).slice(2)}`, x + bw / 2, top + 31);
    lightTile(ctx, x, top + 48, bw, 150);
    if (s.trophies.length === 3) { ctx.fillStyle = 'rgba(242,194,0,.55)'; ctx.fillRect(x, top + 48, bw, 150); }
    ctx.fillStyle = s.finish === 1 ? '#9a6b00' : s.finish <= 4 ? '#2f7d0a' : s.finish >= 18 ? '#b3141c' : '#1d1d1d';
    ctx.font = `900 58px ${FONT}`;
    ctx.fillText(ordinal(s.finish), x + bw / 2, top + 122);
    ctx.fillStyle = '#3b3d41';
    ctx.font = `700 17px ${FONT}`;
    const label = s.trophies.length === 3 ? 'TREBLE' : s.trophies.map((tr) => TROPHY_LABELS[tr]).join(' + ');
    ctx.fillText(fitText(ctx, label, bw - 12), x + bw / 2, top + 170);
    ctx.textAlign = 'left';
  });

  // Highlights in a dark table.
  const rows: [string, string, string][] = [];
  const poc = career.playerOfCareer;
  if (poc) rows.push(['Player of the Career', name(poc.id), `${poc.apps} apps · ${poc.goals} goals · ${poc.avg.toFixed(2)} avg`]);
  const scorer = career.topScorers[0];
  if (scorer && scorer.goals > 0) rows.push(['Top Scorer', name(scorer.id), `${scorer.goals} goals in ${scorer.apps} apps`]);
  if (career.bestPick) {
    const b = career.bestPick;
    rows.push(['Best Pick', name(b.player), `${b.from} → ${b.to} (${b.to - b.from >= 0 ? '+' : ''}${b.to - b.from})`]);
  }
  if (career.worstPick) {
    const w = career.worstPick;
    rows.push(['Worst Pick', name(w.player), `${w.from} → ${w.to} (${w.to - w.from >= 0 ? '+' : ''}${w.to - w.from})`]);
  }
  let y = 634;
  glossBar(ctx, pad, y, W - pad * 2, 44, '#4f74ad', '#284f8c', '#163b74', '#1f4682');
  ctx.fillStyle = '#fff';
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText('Hall of Fame', pad + 20, y + 30);
  y += 44;
  rows.slice(0, 4).forEach(([label, who, detail], i) => {
    ctx.fillStyle = i % 2 ? '#17181a' : '#1e1f21';
    ctx.fillRect(pad, y, W - pad * 2, 92);
    ctx.fillStyle = '#8f9297';
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(label.toUpperCase(), pad + 20, y + 32);
    ctx.fillStyle = '#fff';
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(fitText(ctx, who, 460), pad + 20, y + 72);
    ctx.fillStyle = '#c9cbcf';
    ctx.font = `400 24px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(fitText(ctx, detail, 440), W - pad - 20, y + 72);
    ctx.textAlign = 'left';
    y += 92;
  });

  // Silver command-bar style money strip.
  const my = 1100;
  glossBar(ctx, pad, my, W - pad * 2, 64, '#fdfdfd', '#e8e9eb', '#d3d5d8', '#c6c8cc');
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = '#3b3d41';
  ctx.fillText('LEGACY SCORE', pad + 28, my + 42);
  ctx.fillStyle = '#1d1d1d';
  ctx.font = `900 40px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(career.score.toLocaleString('en-GB'), W - pad - 28, my + 46);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#8f9297';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`Can you win the treble? ${input.site}`, pad, H - 60);
  ctx.textAlign = 'right';
  ctx.fillText(`seed ${input.seed}`, W - pad, H - 60);
  ctx.textAlign = 'left';
}

export async function shareOrDownload(canvas: HTMLCanvasElement, fileName: string, text: string): Promise<'shared' | 'downloaded'> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'),
  );
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'shared';
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
