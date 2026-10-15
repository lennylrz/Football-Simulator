// Draws the end-of-run share card (1080x1350, a 4:5 portrait image).
import type { Career, Trophy } from '../game/career';
import type { ClubInfo } from '../game/clubs';
import { SEASON_YEARS } from '../game/data';
import { formatMoney } from '../game/valuation';

export interface CardInput {
  club: ClubInfo;
  career: Career;
  name: (id: number) => string;
  seed: number;
  site: string;
}

const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TROPHY_COLORS: Record<Trophy, string> = { league: '#fbbf24', fa: '#e2e8f0', cl: '#7dd3fc' };
const TROPHY_LABELS: Record<Trophy, string> = { league: 'League', fa: 'FA Cup', cl: 'Europe' };

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function trophy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  // A simple cup: bowl, handles, stem and base. (x, y) is the top centre.
  const s = size;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.32, y);
  ctx.lineTo(x + s * 0.32, y);
  ctx.quadraticCurveTo(x + s * 0.32, y + s * 0.5, x, y + s * 0.55);
  ctx.quadraticCurveTo(x - s * 0.32, y + s * 0.5, x - s * 0.32, y);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - s * 0.32, y + s * 0.15, s * 0.12, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s * 0.32, y + s * 0.15, s * 0.12, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.fillRect(x - s * 0.05, y + s * 0.55, s * 0.1, s * 0.22);
  ctx.fillRect(x - s * 0.22, y + s * 0.77, s * 0.44, s * 0.1);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export function drawShareCard(canvas: HTMLCanvasElement, input: CardInput): void {
  const { club, career, name } = input;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background and club colour band.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = club.primary;
  ctx.fillRect(0, 0, W, 28);
  ctx.fillStyle = club.secondary;
  ctx.fillRect(0, 28, W, 10);

  const pad = 72;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText('FIVE SEASONS · 2015/16 – 2019/20', pad, 110);

  // Club badge and name.
  ctx.beginPath();
  ctx.arc(pad + 56, 200, 56, 0, Math.PI * 2);
  ctx.fillStyle = club.primary;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = club.secondary;
  ctx.font = `900 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(club.code, pad + 56, 214);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText(fitText(ctx, club.name, W - pad * 2 - 140), pad + 140, 222);

  // Headline.
  const t = career.trophies;
  const total = t.league + t.fa + t.cl;
  let headline: string;
  if (career.trebles > 0) headline = career.trebles > 1 ? `${career.trebles}× TREBLE WINNERS` : 'TREBLE WINNERS';
  else if (total === 0) headline = 'No trophies. Yet.';
  else {
    const parts: string[] = [];
    if (t.league) parts.push(`${t.league} league title${t.league > 1 ? 's' : ''}`);
    if (t.fa) parts.push(`${t.fa} FA Cup${t.fa > 1 ? 's' : ''}`);
    if (t.cl) parts.push(`${t.cl} Champions League${t.cl > 1 ? 's' : ''}`);
    headline = parts.join(' · ');
  }
  if (career.trebles > 0) {
    const g = ctx.createLinearGradient(pad, 270, W - pad, 380);
    g.addColorStop(0, '#fcd34d');
    g.addColorStop(0.5, '#fef3c7');
    g.addColorStop(1, '#f59e0b');
    roundRect(ctx, pad, 270, W - pad * 2, 120, 24);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.font = `900 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(headline, W / 2, 352);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = total ? '#fbbf24' : '#cbd5e1';
    ctx.font = `800 ${headline.length > 34 ? 40 : 52}px ${FONT}`;
    ctx.fillText(fitText(ctx, headline, W - pad * 2), pad, 340);
  }

  // Season by season.
  const top = 430;
  const gap = 16;
  const bw = (W - pad * 2 - gap * 4) / 5;
  career.seasons.forEach((s, i) => {
    const x = pad + i * (bw + gap);
    roundRect(ctx, x, top, bw, 230, 20);
    ctx.fillStyle = s.trophies.length === 3 ? 'rgba(251,191,36,0.22)' : '#1e293b';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 26px ${FONT}`;
    const y0 = SEASON_YEARS[s.season];
    ctx.fillText(`${y0}/${String(y0 + 1).slice(2)}`, x + bw / 2, top + 46);
    ctx.fillStyle = s.finish === 1 ? '#fbbf24' : s.finish <= 4 ? '#34d399' : s.finish >= 18 ? '#fb7185' : '#f8fafc';
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText(ordinal(s.finish), x + bw / 2, top + 126);
    const n = s.trophies.length;
    s.trophies.forEach((tr, k) => trophy(ctx, x + bw / 2 + (k - (n - 1) / 2) * 46, top + 150, 48, TROPHY_COLORS[tr]));
    ctx.textAlign = 'left';
  });

  // Trophy legend.
  let lx = pad;
  ctx.font = `600 24px ${FONT}`;
  (['league', 'fa', 'cl'] as Trophy[]).forEach((tr) => {
    trophy(ctx, lx + 14, 684, 30, TROPHY_COLORS[tr]);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${TROPHY_LABELS[tr]} ×${career.trophies[tr]}`, lx + 36, 708);
    lx += 230;
  });

  // Highlights.
  const rows: [string, string, string][] = [];
  const poc = career.playerOfCareer;
  if (poc) rows.push(['Player of the career', name(poc.id), `${poc.apps} apps · ${poc.goals} goals · ${poc.avg.toFixed(2)} avg`]);
  const scorer = career.topScorers[0];
  if (scorer && scorer.goals > 0) rows.push(['Top scorer', name(scorer.id), `${scorer.goals} goals in ${scorer.apps} apps`]);
  if (career.bestSigning) {
    const b = career.bestSigning;
    rows.push(['Best signing', name(b.t.player), `${formatMoney(b.t.fee)} → ${b.apps} apps, ${b.sold ? `sold for ${formatMoney(b.exitValue)}` : `worth ${formatMoney(b.exitValue)}`}`]);
  }
  if (career.worstSigning) {
    const w = career.worstSigning;
    rows.push(['Worst signing', name(w.t.player), `${formatMoney(w.t.fee)} → ${w.apps} apps, ${w.sold ? `sold for ${formatMoney(w.exitValue)}` : `worth ${formatMoney(w.exitValue)}`}`]);
  }
  let y = 770;
  for (const [label, who, detail] of rows.slice(0, 4)) {
    ctx.fillStyle = '#64748b';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(label.toUpperCase(), pad, y);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(fitText(ctx, who, 470), pad, y + 46);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 28px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(fitText(ctx, detail, W - pad * 2 - 490), W - pad, y + 44);
    ctx.textAlign = 'left';
    y += 96;
  }

  // Money.
  const my = 1200;
  roundRect(ctx, pad, my - 52, W - pad * 2, 76, 18);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.font = `700 30px ${FONT}`;
  const net = career.earned - career.spent;
  const money: [string, string, string][] = [
    ['Spent', formatMoney(career.spent), '#fb7185'],
    ['Earned', formatMoney(career.earned), '#34d399'],
    ['Net', `${net >= 0 ? '+' : ''}${formatMoney(net)}`, net >= 0 ? '#34d399' : '#fb7185'],
  ];
  money.forEach(([label, value, color], i) => {
    const cx = pad + 30 + i * ((W - pad * 2) / 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${label} `, cx, my);
    const lw = ctx.measureText(`${label} `).width;
    ctx.fillStyle = color;
    ctx.fillText(value, cx + lw, my);
  });

  ctx.fillStyle = '#475569';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(`Can you do better? ${input.site}`, pad, H - 50);
  ctx.textAlign = 'right';
  ctx.fillText(`seed ${input.seed}`, W - pad, H - 50);
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
