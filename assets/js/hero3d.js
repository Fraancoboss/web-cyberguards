/* CyberGuards – AI: hero scene.
   A living 3D graph of red edges that keeps re-wiring itself around the CyberGuards mark
   (C + inverted G) drawn as a folded wireframe. Data packets travel the graph and a
   scan sweep lights up whatever it crosses. */
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.querySelector(".hero__canvas");
const hero = document.querySelector(".hero");

// Logo geometry, in the same units as the SVG mark (x centred on the seam).
const quad = (p0, p1, p2, n = 12) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return out;
};
const LOGO = {
  c: [
    [[0, 75], [-120, 28], [-120, 268], [0, 348]],
    [[0, 108], [-88, 74], [-88, 252], [0, 311]],
    quad([0, 43], [-60, 43], [-120, 28]),
  ],
  g: [
    [[0, 75], [120, 28], [120, 268], [0, 348]],
    [[0, 75], [0, 140], [32, 128], [32, 96], [88, 74], [88, 252], [40, 284], [40, 252], [58, 235], [58, 204], [0, 243], [0, 348]],
    quad([0, 43], [60, 43], [120, 28]),
  ],
};

function init() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 760px)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    hero.classList.add("no-webgl");
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const RED = new THREE.Color(0xff2d3d);
  const WHITE = new THREE.Color(0xededed);

  const world = new THREE.Group();
  scene.add(world);
  const graph = new THREE.Group();
  world.add(graph);

  // ---------- The mark: folded wireframe ----------
  const U = 105, FOLD = 0.34, DEPTH = 0.13, XMAX = 120 / U;
  const to3 = ([x, y], dz) => {
    const X = x / U, Y = -(y - 188) / U;
    return new THREE.Vector3(X, Y, FOLD * (0.5 - Math.abs(X) / XMAX) + dz);
  };

  const logo = new THREE.Group();
  graph.add(logo);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const ball = new THREE.SphereGeometry(1, 10, 8);
  const TUBE = 0.0125;

  const strokes = []; // { mesh, joints, segs:[{a,b,start,len}], verts:[{p,at}], total }
  const anchors = []; // front-face corners the network can latch onto
  const seen = new Set();
  const backPts = [], linkPts = [];

  for (const [key, color] of [["c", WHITE], ["g", RED]]) {
    for (const line of LOGO[key]) {
      const front = line.map((p) => to3(p, DEPTH));
      const back = line.map((p) => to3(p, -DEPTH));
      const segs = [];
      let total = 0;
      for (let i = 0; i < front.length - 1; i++) {
        const len = front[i].distanceTo(front[i + 1]);
        segs.push({ a: front[i], b: front[i + 1], start: total, len });
        total += len;
        backPts.push(back[i], back[i + 1]);
      }
      const curve = line === LOGO[key][2];
      front.forEach((p, i) => {
        if (curve && i !== 0 && i !== front.length - 1) return;
        linkPts.push(p, back[i]);
        const k = line[i].join(",");
        if (!seen.has(k)) { seen.add(k); anchors.push(p); }
      });
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.InstancedMesh(cyl, mat, segs.length);
      const joints = new THREE.InstancedMesh(ball, mat, front.length);
      mesh.frustumCulled = joints.frustumCulled = false;
      logo.add(mesh, joints);
      strokes.push({ mesh, joints, segs, verts: front.map((p, i) => ({ p, at: i === 0 ? 0 : segs[i - 1].start + segs[i - 1].len })), total });
    }
  }

  const ghostMat = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const linkMat = ghostMat.clone();
  logo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(backPts), ghostMat));
  logo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linkPts), linkMat));

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: radialTexture(), color: RED, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.scale.set(5.2, 5.2, 1);
  glow.position.z = -0.6;
  logo.add(glow);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const D = new THREE.Vector3(), E = new THREE.Vector3(), MID = new THREE.Vector3();
  function drawLogo(r) {
    for (const s of strokes) {
      const at = r * s.total;
      s.segs.forEach((g, i) => {
        const f = Math.min(1, Math.max(0, (at - g.start) / g.len));
        if (f <= 0) M.makeScale(0, 0, 0);
        else {
          E.copy(g.a).lerp(g.b, f);
          D.subVectors(E, g.a);
          const len = D.length();
          Q.setFromUnitVectors(UP, D.normalize());
          M.compose(MID.addVectors(g.a, E).multiplyScalar(0.5), Q, S.set(TUBE, len, TUBE));
        }
        s.mesh.setMatrixAt(i, M);
      });
      s.verts.forEach((v, i) => {
        const k = v.at <= at ? TUBE : 0;
        M.compose(v.p, Q.identity(), S.set(k, k, k));
        s.joints.setMatrixAt(i, M);
      });
      s.mesh.instanceMatrix.needsUpdate = s.joints.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- The network ----------
  const N = small ? 92 : 132;
  const LINK = small ? 1.12 : 1.02;
  const R1 = 2.05, R2 = 3.3;
  const nR = new Float32Array(N), nTh = new Float32Array(N), nPh = new Float32Array(N), nW = new Float32Array(N), nF = new Float32Array(N * 3), nP = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    nR[i] = Math.cbrt(Math.random() * (R2 ** 3 - R1 ** 3) + R1 ** 3);
    nTh[i] = Math.random() * Math.PI * 2;
    nPh[i] = Math.asin(Math.random() * 2 - 1) * 0.92;
    nW[i] = 0.05 + Math.random() * 0.09;
    for (let k = 0; k < 3; k++) { nF[i * 3 + k] = 0.25 + Math.random() * 0.5; nP[i * 3 + k] = Math.random() * 6.283; }
  }
  const P = new Float32Array(N * 3); // live node positions
  const F = new Float32Array(N); // per-node visibility (depth + not covering the mark)
  const SCAN = new Float32Array(N);

  const MAXE = 1400;
  const ePos = new Float32Array(MAXE * 6), eCol = new Float32Array(MAXE * 6);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3).setUsage(THREE.DynamicDrawUsage));
  edgeGeo.setAttribute("color", new THREE.BufferAttribute(eCol, 3).setUsage(THREE.DynamicDrawUsage));
  const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.frustumCulled = false;
  graph.add(edges);

  const pointMat = (extra = "") => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixel: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      uniform float uPixel;
      attribute float aA, aS, aHot;
      varying float vA, vHot;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = aA; vHot = aHot;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aS * uPixel * (9.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA, vHot;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = smoothstep(0.22, 0.0, d), halo = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(1.0, 0.16, 0.22), vec3(1.0, 0.86, 0.86), max(core * 0.75, vHot) );
        gl_FragColor = vec4(col, (halo * 0.55 + core) * vA);
      }`,
  });

  const nodeGeo = new THREE.BufferGeometry();
  const nA = new Float32Array(N), nS = new Float32Array(N), nHot = new Float32Array(N);
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
  nodeGeo.setAttribute("aA", new THREE.BufferAttribute(nA, 1).setUsage(THREE.DynamicDrawUsage));
  nodeGeo.setAttribute("aS", new THREE.BufferAttribute(nS, 1).setUsage(THREE.DynamicDrawUsage));
  nodeGeo.setAttribute("aHot", new THREE.BufferAttribute(nHot, 1).setUsage(THREE.DynamicDrawUsage));
  const nodeMat = pointMat();
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  nodes.frustumCulled = false;
  graph.add(nodes);

  // Packets hopping along live edges (each drawn as a short comet)
  const PK = small ? 10 : 20, TRAIL = 5;
  const pk = Array.from({ length: PK }, () => ({ a: (Math.random() * N) | 0, b: (Math.random() * N) | 0, t: Math.random(), v: 0.7 + Math.random() * 0.6 }));
  const pkPos = new Float32Array(PK * TRAIL * 3), pkA = new Float32Array(PK * TRAIL), pkS = new Float32Array(PK * TRAIL), pkHot = new Float32Array(PK * TRAIL);
  for (let i = 0; i < PK * TRAIL; i++) { const k = i % TRAIL; pkS[i] = 5.2 - k * 0.8; pkHot[i] = k === 0 ? 1 : 0; }
  const pkGeo = new THREE.BufferGeometry();
  pkGeo.setAttribute("position", new THREE.BufferAttribute(pkPos, 3).setUsage(THREE.DynamicDrawUsage));
  pkGeo.setAttribute("aA", new THREE.BufferAttribute(pkA, 1).setUsage(THREE.DynamicDrawUsage));
  pkGeo.setAttribute("aS", new THREE.BufferAttribute(pkS, 1));
  pkGeo.setAttribute("aHot", new THREE.BufferAttribute(pkHot, 1));
  const pkMat = pointMat();
  const packets = new THREE.Points(pkGeo, pkMat);
  packets.frustumCulled = false;
  graph.add(packets);

  const NB = 10;
  const nbCount = new Uint8Array(N), nbList = new Uint16Array(N * NB);

  // ---------- Simulation ----------
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function step(t, e, dt, yaw) {
    const spread = 0.55 + 0.45 * e;
    const scanY = Math.sin(t * 0.42) * 3.3;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);

    for (let i = 0; i < N; i++) {
      const th = nTh[i] + nW[i] * t, ph = nPh[i], r = nR[i] * spread;
      const j = i * 3;
      const x = r * Math.cos(ph) * Math.cos(th) + 0.16 * Math.sin(t * nF[j] + nP[j]);
      const y = r * Math.sin(ph) + 0.16 * Math.sin(t * nF[j + 1] + nP[j + 1]);
      const z = r * Math.cos(ph) * Math.sin(th) + 0.16 * Math.sin(t * nF[j + 2] + nP[j + 2]);
      P[j] = x; P[j + 1] = y; P[j + 2] = z;
      const zv = -x * sy + z * cy; // depth as seen by the camera
      const depth = 0.22 + 0.78 * smooth(-R2, R2 * 0.8, zv);
      const clear = zv > 0 ? 0.3 + 0.7 * smooth(1.0, 1.9, Math.hypot(x * cy + z * sy, y)) : 1;
      F[i] = depth * clear * e;
      const sc = Math.exp(-(((y - scanY) / 0.32) ** 2));
      SCAN[i] = sc;
      nA[i] = F[i] * (0.55 + 0.45 * sc);
      nS[i] = 3.4 + sc * 3.2;
      nHot[i] = sc * 0.8;
      nbCount[i] = 0;
    }

    let c = 0;
    const pushEdge = (ax, ay, az, bx, by, bz, a, hot) => {
      if (c >= MAXE) return;
      const o = c * 6;
      ePos[o] = ax; ePos[o + 1] = ay; ePos[o + 2] = az; ePos[o + 3] = bx; ePos[o + 4] = by; ePos[o + 5] = bz;
      const r = RED.r + (1 - RED.r) * hot * 0.6, g = RED.g + (0.75 - RED.g) * hot * 0.6, b = RED.b + (0.75 - RED.b) * hot * 0.6;
      eCol[o] = eCol[o + 3] = r * a; eCol[o + 1] = eCol[o + 4] = g * a; eCol[o + 2] = eCol[o + 5] = b * a;
      c++;
    };
    const link = LINK * (0.8 + 0.2 * e);
    for (let i = 0; i < N; i++) {
      const ix = P[i * 3], iy = P[i * 3 + 1], iz = P[i * 3 + 2];
      for (let k = i + 1; k < N; k++) {
        const dx = P[k * 3] - ix, dy = P[k * 3 + 1] - iy, dz = P[k * 3 + 2] - iz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > link * link) continue;
        const f = 1 - Math.sqrt(d2) / link;
        const hot = Math.max(SCAN[i], SCAN[k]);
        pushEdge(ix, iy, iz, P[k * 3], P[k * 3 + 1], P[k * 3 + 2], f * f * Math.min(F[i], F[k]) * (0.85 + hot * 0.9), hot);
        if (nbCount[i] < NB) nbList[i * NB + nbCount[i]++] = k;
        if (nbCount[k] < NB) nbList[k * NB + nbCount[k]++] = i;
      }
      // the mark is part of the graph: nodes latch onto its corners
      for (const p of anchors) {
        const dx = p.x - ix, dy = p.y - iy, dz = p.z - iz;
        const d2 = dx * dx + dy * dy + dz * dz;
        const lim = link * 0.95;
        if (d2 > lim * lim) continue;
        const f = 1 - Math.sqrt(d2) / lim;
        pushEdge(ix, iy, iz, p.x, p.y, p.z, f * F[i] * 0.9, SCAN[i]);
      }
    }
    edgeGeo.setDrawRange(0, c * 2);
    edgeGeo.attributes.position.needsUpdate = edgeGeo.attributes.color.needsUpdate = true;
    nodeGeo.attributes.position.needsUpdate = nodeGeo.attributes.aA.needsUpdate = true;
    nodeGeo.attributes.aS.needsUpdate = nodeGeo.attributes.aHot.needsUpdate = true;

    // packets
    for (let p = 0; p < PK; p++) {
      const q = pk[p];
      const ax = P[q.a * 3], ay = P[q.a * 3 + 1], az = P[q.a * 3 + 2];
      const bx = P[q.b * 3], by = P[q.b * 3 + 1], bz = P[q.b * 3 + 2];
      const len = Math.hypot(bx - ax, by - ay, bz - az) || 1;
      q.t += (dt * q.v) / len;
      if (q.t >= 1) {
        const n = nbCount[q.b];
        let next = q.a;
        if (n) { next = nbList[q.b * NB + ((Math.random() * n) | 0)]; if (next === q.a && n > 1) next = nbList[q.b * NB + ((Math.random() * n) | 0)]; }
        q.a = q.b; q.b = next; q.t = 0;
      }
      const vis = Math.min(F[q.a], F[q.b]);
      for (let k = 0; k < TRAIL; k++) {
        const tt = Math.max(0, q.t - k * 0.045);
        const o = (p * TRAIL + k) * 3;
        const sx = P[q.a * 3], sy2 = P[q.a * 3 + 1], sz = P[q.a * 3 + 2];
        pkPos[o] = sx + (P[q.b * 3] - sx) * tt;
        pkPos[o + 1] = sy2 + (P[q.b * 3 + 1] - sy2) * tt;
        pkPos[o + 2] = sz + (P[q.b * 3 + 2] - sz) * tt;
        pkA[p * TRAIL + k] = vis * (1 - k / TRAIL) * (q.t - k * 0.045 >= 0 ? 1 : 0) * 1.4;
      }
    }
    pkGeo.attributes.position.needsUpdate = pkGeo.attributes.aA.needsUpdate = true;
  }

  // ---------- Layout ----------
  const EXTENT = 3.45;
  let layout = { x: 0, y: 0, s: 1 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (camera.aspect > 1.05) {
      layout = { x: halfW * 0.46, y: -halfH * 0.02, s: Math.min(0.95, (halfH * 0.86) / EXTENT) };
    } else {
      layout = { x: 0, y: halfH * 0.04, s: Math.min(0.85, (halfW * 1.12) / EXTENT) };
    }
    nodeMat.uniforms.uPixel.value = pkMat.uniforms.uPixel.value = renderer.getPixelRatio();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- Interaction ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // Entrance, triggered by the intro timeline (with a fallback)
  let introStart = null;
  const startIntro = () => { if (introStart === null) introStart = performance.now(); };
  addEventListener("cg:hero", startIntro, { once: true });
  setTimeout(startIntro, 3500);

  const clock = new THREE.Clock();
  const easeOut = (x) => 1 - Math.pow(1 - x, 4);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let last = 0, drawn = -1;

  function render(fixedT) {
    const t = fixedT ?? clock.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0, t - last));
    last = t;
    const intro = introStart === null ? 0 : Math.min(1, (performance.now() - introStart) / 2600);
    const e = reduce ? 1 : easeOut(intro);
    const draw = reduce ? 1 : easeInOut(Math.min(1, Math.max(0, (intro - 0.05) / 0.75)));
    const scroll = Math.min(1.2, scrollY / innerHeight);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    world.position.set(layout.x, layout.y + scroll * 0.6, 0);
    world.scale.setScalar(layout.s * (1 - scroll * 0.12));

    const yaw = (1 - e) * -0.9 + Math.sin(t * 0.32) * 0.38 + pointer.x * 0.4 + scroll * 0.9;
    graph.rotation.set(Math.sin(t * 0.27) * 0.06 + pointer.y * 0.18, yaw, 0);
    logo.position.y = Math.sin(t * 0.8) * 0.04;

    if (draw !== drawn) { drawLogo(draw); drawn = draw; }
    ghostMat.opacity = 0.32 * draw;
    linkMat.opacity = 0.22 * draw;
    glow.material.opacity = (0.22 + Math.sin(t * 1.4) * 0.04) * e;

    step(t, e, reduce ? 0 : dt, yaw);

    canvas.style.opacity = String(1 - Math.min(1, scroll) * 0.85);
    renderer.render(scene, camera);
  }

  // ---------- Loop: only while visible ----------
  let raf = 0, visible = true;
  const loop = () => { render(); raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  if (reduce) {
    introStart = 0;
    const still = () => render(6);
    still();
    new ResizeObserver(still).observe(canvas);
    return;
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
}

function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,.3)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

if (canvas && hero) init();
