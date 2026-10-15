// Draws the shattered-ball background of the main menu.
export function drawShards(cv: HTMLCanvasElement): void {
  const g = cv.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, 1280, 720);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cx = 930;
  const cy = 330;
  const shard = (a0: number, a1: number, r0: number, r1: number, push: number, tilt: number) => {
    const am = (a0 + a1) / 2;
    const ox = Math.cos(am) * push;
    const oy = Math.sin(am) * push;
    const pts = ([[a0, r0], [a1, r0], [a1 + tilt, r1], [a0 + tilt, r1]] as const).map(([a, r]) => [cx + ox + Math.cos(a) * r, cy + oy + Math.sin(a) * r]);
    g.save();
    g.shadowColor = 'rgba(30,50,80,.28)';
    g.shadowBlur = 16;
    g.shadowOffsetY = 6;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const lg = g.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]);
    lg.addColorStop(0, '#ffffff');
    lg.addColorStop(0.55, '#e7ecf2');
    lg.addColorStop(1, '#bcc7d4');
    g.fillStyle = lg;
    g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(40,90,160,.55)';
    g.beginPath();
    g.moveTo(pts[2][0], pts[2][1]);
    g.lineTo(pts[3][0], pts[3][1]);
    g.stroke();
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(pts[1][0], pts[1][1]);
    g.stroke();
    g.restore();
  };
  const glow = g.createRadialGradient(cx, cy, 20, cx, cy, 330);
  glow.addColorStop(0, 'rgba(255,255,255,.95)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1280, 720);
  const ball = g.createRadialGradient(cx - 30, cy - 34, 10, cx, cy, 96);
  ball.addColorStop(0, '#ffffff');
  ball.addColorStop(0.6, '#e3e9f1');
  ball.addColorStop(1, '#a9b8cb');
  g.save();
  g.shadowColor = 'rgba(30,50,80,.3)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 8;
  g.beginPath();
  g.arc(cx, cy, 92, 0, Math.PI * 2);
  g.fillStyle = ball;
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(40,90,160,.45)';
  g.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    const a = k * 1.2566 - 1.57;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92);
    g.stroke();
  }
  g.beginPath();
  for (let k = 0; k <= 5; k++) {
    const a = k * 1.2566 - 1.57;
    const x = cx + Math.cos(a) * 34;
    const y = cy + Math.sin(a) * 34;
    if (k) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.fillStyle = 'rgba(31,63,116,.85)';
  g.fill();
  for (const [r0, r1, n, push] of [[262, 306, 20, 52], [214, 258, 17, 36], [168, 210, 14, 22], [124, 164, 11, 12]]) {
    for (let k = 0; k < n; k++) {
      if (rnd() < 0.12) continue;
      const a0 = (k / n) * Math.PI * 2 + rnd() * 0.05;
      const a1 = a0 + (Math.PI * 2) / n - 0.05;
      shard(a0, a1, r0, r1, push * (0.6 + rnd()), (rnd() - 0.5) * 0.08);
    }
  }
  for (let k = 0; k < 7; k++) {
    const a = rnd() * Math.PI * 2;
    shard(a, a + 0.22, 330 + rnd() * 80, 372 + rnd() * 80, 40 + rnd() * 90, 0.06);
  }
}
