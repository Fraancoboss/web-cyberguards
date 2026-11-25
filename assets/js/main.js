/* CyberGuards – AI
   Hero visual: a lightweight generative "video" (a guarded data globe).
   To use a real video instead, set data-video="assets/video/hero.mp4" on .visual. */

(() => {
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  const figure = document.querySelector(".visual");
  if (!figure) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Optional real video ----
  const videoSrc = figure.dataset.video;
  if (videoSrc) {
    const video = document.createElement("video");
    Object.assign(video, { src: videoSrc, muted: true, loop: true, playsInline: true, autoplay: !reduceMotion });
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("preload", "metadata");
    figure.querySelector("canvas")?.remove();
    figure.prepend(video);
    return;
  }

  // ---- Generative globe ----
  const canvas = figure.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;

  const TAU = Math.PI * 2;
  const POINTS = 1100;
  const TILT = 0.38;

  // Fibonacci sphere
  const sphere = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < POINTS; i++) {
    const y = 1 - (i / (POINTS - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    sphere.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }

  // Hubs: a fixed set of nodes the arcs travel between
  const rand = mulberry32(2030);
  const hubs = Array.from({ length: 16 }, () => sphere[Math.floor(rand() * POINTS)]);

  const arcs = [];
  function spawnArc(now) {
    const a = hubs[Math.floor(Math.random() * hubs.length)];
    let b = a;
    while (b === a) b = hubs[Math.floor(Math.random() * hubs.length)];
    arcs.push({ a, b, born: now, life: 2600 + Math.random() * 1800 });
  }

  function slerp(a, b, t) {
    const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const om = Math.acos(dot);
    if (om < 1e-4) return a.slice();
    const s = Math.sin(om);
    const k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }

  function project(p, rot, R, cx, cy) {
    // rotate around Y, then tilt around X
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    let x = p[0] * cosR - p[2] * sinR;
    let z = p[0] * sinR + p[2] * cosR;
    let y = p[1];
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    const y2 = y * cosT - z * sinT;
    const z2 = y * sinT + z * cosT;
    const persp = 1 / (1 - z2 * 0.18);
    return [cx + x * R * persp, cy + y2 * R * persp, z2];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let lastSpawn = 0;
  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * 0.27;
    const cx = w * 0.5, cy = h * 0.5;
    const rot = now * 0.00012;

    // Atmosphere
    const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.6);
    glow.addColorStop(0, "rgba(94, 180, 138, 0.16)");
    glow.addColorStop(1, "rgba(94, 180, 138, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Orbit ring with a sentinel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.32);
    ctx.strokeStyle = "rgba(200, 232, 214, 0.22)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 1.42, R * 0.46, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const s = now * 0.0004;
    const sx = Math.cos(s) * R * 1.42, sy = Math.sin(s) * R * 0.46;
    ctx.fillStyle = "rgba(232, 246, 238, 0.95)";
    ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, TAU); ctx.fill();
    ctx.restore();

    // Dots
    for (let i = 0; i < POINTS; i++) {
      const [x, y, z] = project(sphere[i], rot, R, cx, cy);
      const front = (z + 1) / 2;
      const a = 0.08 + front * front * 0.85;
      ctx.fillStyle = `rgba(159, 211, 184, ${a})`;
      const size = 0.7 + front * 1.3;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    // Hubs
    for (const hub of hubs) {
      const [x, y, z] = project(hub, rot, R, cx, cy);
      if (z < -0.1) continue;
      ctx.strokeStyle = `rgba(232, 246, 238, ${0.25 + z * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.stroke();
    }

    // Arcs: data flowing between nodes
    if (now - lastSpawn > 420 && arcs.length < 9) { spawnArc(now); lastSpawn = now; }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      const t = (now - arc.born) / arc.life;
      if (t >= 1) { arcs.splice(i, 1); continue; }
      const head = Math.min(1, t * 1.6);
      const tail = Math.max(0, t * 1.6 - 0.6);
      const steps = 40;
      ctx.lineWidth = 1.2;
      for (let k = 0; k < steps; k++) {
        const u0 = tail + (head - tail) * (k / steps);
        const u1 = tail + (head - tail) * ((k + 1) / steps);
        const p0 = lift(slerp(arc.a, arc.b, u0), u0);
        const p1 = lift(slerp(arc.a, arc.b, u1), u1);
        const q0 = project(p0, rot, R, cx, cy), q1 = project(p1, rot, R, cx, cy);
        const vis = Math.max(0, (q0[2] + 0.35));
        if (vis <= 0) continue;
        const alpha = (k / steps) * Math.min(1, vis) * 0.9;
        ctx.strokeStyle = `rgba(214, 240, 226, ${alpha})`;
        ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
      }
      if (head < 1) {
        const ph = project(lift(slerp(arc.a, arc.b, head), head), rot, R, cx, cy);
        if (ph[2] > -0.35) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.beginPath(); ctx.arc(ph[0], ph[1], 1.8, 0, TAU); ctx.fill();
        }
      }
    }
  }

  function lift(p, u) {
    const k = 1 + Math.sin(Math.PI * u) * 0.22;
    return [p[0] * k, p[1] * k, p[2] * k];
  }

  // ---- Loop control: only animate when visible (saves energy) ----
  let raf = 0, inView = true;
  const loop = (now) => { frame(now); raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && !reduceMotion && inView && !document.hidden) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  resize();
  if (reduceMotion) {
    for (let i = 0; i < 6; i++) spawnArc(-i * 500);
    frame(1500);
  } else {
    start();
  }

  new ResizeObserver(() => { resize(); if (reduceMotion) frame(1500); }).observe(canvas);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; inView ? start() : stop(); }).observe(figure);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
