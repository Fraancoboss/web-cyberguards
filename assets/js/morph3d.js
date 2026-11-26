/* CyberGuards – AI: services stage.
   One particle body that morphs as you scroll through the three services:
   neural sphere (context) -> knot (resilience) -> shield (compliance). */
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.querySelector(".services__canvas");
const section = document.querySelector(".services");
if (canvas && section) init();

function init() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 760px)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);

  const N = small ? 4200 : 8000;
  const A = new Float32Array(N * 3); // neural sphere
  const B = new Float32Array(N * 3); // torus knot
  const C = new Float32Array(N * 3); // shield
  const rand = new Float32Array(N);
  const glyph = new Float32Array(N); // 1 if the particle draws the red G in the shield

  // A: noisy sphere shell + inner synapses
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    let x = Math.cos(a) * s, y = u, z = Math.sin(a) * s;
    const shell = Math.random() < 0.78;
    const n = 1 + 0.13 * Math.sin(x * 4.0 + y * 3.0) * Math.cos(z * 5.0 - y * 2.0);
    const r = shell ? 1.45 * n : 1.35 * Math.cbrt(Math.random());
    A.set([x * r, y * r, z * r], i * 3);
    rand[i] = Math.random();
  }

  // B: (2,3) torus knot with a fuzzy tube
  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2;
    const p = 2, q = 3;
    const rr = Math.cos(q * t) + 2.2;
    const cx = rr * Math.cos(p * t), cy = rr * Math.sin(p * t), cz = -Math.sin(q * t);
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const k = 0.24 * Math.sqrt(Math.random());
    B.set([(cx + Math.cos(a) * s * k) * 0.46, (cy + u * k) * 0.46, (cz + Math.sin(a) * s * k) * 0.46], i * 3);
  }

  // C: the CyberGuards mark (white C band + red inverted-G band + folded top face), SVG units
  const C_BAND = [[0, 75], [-120, 28], [-120, 268], [0, 348], [0, 311], [-88, 252], [-88, 74], [0, 108]];
  const G_BAND = [[0, 75], [120, 28], [120, 268], [0, 348], [0, 243], [58, 204], [58, 235], [40, 252], [40, 284], [88, 252], [88, 74], [32, 96], [32, 128], [0, 140]];
  const EDGES = [
    [C_BAND, 0], [G_BAND, 1],
  ].flatMap(([poly, g]) => poly.map((p, i) => [p, poly[(i + 1) % poly.length], g]))
    .map(([a, b, g]) => [a, b, g, Math.hypot(b[0] - a[0], b[1] - a[1])]);
  const edgeTotal = EDGES.reduce((s, e) => s + e[3], 0);
  const topY = (x) => { const s = (x + 120) / 240; return 28 + 60 * s * (1 - s); };
  const ridgeY = (x) => 75 - (47 / 120) * Math.abs(x);
  const u = 1.15 / 120;
  for (let i = 0; i < N; i++) {
    const r = Math.random();
    let x, y, z = (Math.random() - 0.5) * 22, g;
    if (r < 0.5) {
      do { x = Math.random() * 240 - 120; y = 28 + Math.random() * 320; } while (!inPoly(x, y, C_BAND) && !inPoly(x, y, G_BAND));
      g = inPoly(x, y, G_BAND) ? 1 : 0;
    } else if (r < 0.88) {
      let d = Math.random() * edgeTotal, k = 0;
      while (d > EDGES[k][3]) { d -= EDGES[k][3]; k++; }
      const [a, b, gg, l] = EDGES[k], f = d / l;
      x = a[0] + (b[0] - a[0]) * f + (Math.random() - 0.5) * 4;
      y = a[1] + (b[1] - a[1]) * f + (Math.random() - 0.5) * 4;
      z *= 0.4;
      g = gg;
    } else {
      x = Math.random() * 240 - 120;
      y = topY(x) + Math.random() * (ridgeY(x) - topY(x));
      g = x > 0 ? 1 : 0;
    }
    const X = x * u;
    z += 0.32 * (0.5 - Math.abs(X) / 1.15) / u; // fold: seam forward, edges back
    C.set([X, -(y - 188) * u, z * u], i * 3);
    glyph[i] = g;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(A, 3));
  geo.setAttribute("aB", new THREE.BufferAttribute(B, 3));
  geo.setAttribute("aC", new THREE.BufferAttribute(C, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  geo.setAttribute("aGlyph", new THREE.BufferAttribute(glyph, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMorph: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      uniform float uTime, uMorph, uPixel;
      attribute vec3 aB, aC;
      attribute float aRand, aGlyph;
      varying float vA, vRed;
      void main() {
        float m1 = clamp(uMorph, 0.0, 1.0);
        float m2 = clamp(uMorph - 1.0, 0.0, 1.0);
        float d = aRand * 0.35;
        float s1 = smoothstep(d, d + 0.65, m1);
        float s2 = smoothstep(d, d + 0.65, m2);
        vec3 p = mix(mix(position, aB, s1), aC, s2);

        // turbulence while in transit
        float transit = sin(3.14159 * s1) + sin(3.14159 * s2);
        vec3 swirl = vec3(sin(uTime * 1.3 + aRand * 20.0), cos(uTime * 1.1 + aRand * 17.0), sin(uTime * 0.9 + aRand * 13.0));
        p += swirl * transit * 0.35 * (0.4 + aRand);
        // idle breathing
        p += normalize(p + 1e-4) * sin(uTime * 1.2 + aRand * 6.2831) * 0.015;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float front = smoothstep(-9.5, -5.2, mv.z);
        vRed = max(step(0.965, aRand), aGlyph * s2);
        vA = (0.12 + front * 0.7) * (0.8 + 0.2 * sin(uTime * 3.0 + aRand * 50.0));
        vA *= 1.0 + 0.7 * s2 * (1.0 - aGlyph);
        gl_PointSize = (1.2 + vRed * 1.3) * uPixel * (7.2 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA, vRed;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 col = mix(vec3(0.86), vec3(1.0, 0.17, 0.24), vRed);
        gl_FragColor = vec4(col, smoothstep(0.5, 0.0, d) * vA * (1.0 + vRed * 0.9));
      }`,
  });
  const body = new THREE.Points(geo, mat);
  scene.add(body);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const stackedStage = w >= innerWidth * 0.9; // mobile: short band above the text, labels at its foot
    body.scale.setScalar(Math.min(0.95, Math.min(halfW, halfH) / (stackedStage ? 2.4 : 2.05)));
    body.position.y = stackedStage ? halfH * 0.1 : 0;
    mat.uniforms.uPixel.value = renderer.getPixelRatio();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Scroll -> morph target: each service morphs in as its panel crosses the reading line
  const panels = [...section.querySelectorAll(".service")];
  const stage = section.querySelector(".services__stage");
  function target() {
    const stacked = stage.getBoundingClientRect().width >= innerWidth * 0.9;
    const line = stacked ? stage.getBoundingClientRect().bottom + innerHeight * 0.25 : innerHeight * 0.7;
    const span = innerHeight * 0.35;
    let m = 0;
    for (let i = 1; i < panels.length; i++) {
      m += smooth(0, 1, (line - panels[i].getBoundingClientRect().top) / span);
    }
    return m;
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const clock = new THREE.Clock();
  let morph = 0, spin = 0, last = 0;

  function render() {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, t - last);
    last = t;
    morph += (target() - morph) * (reduce ? 1 : 0.06);
    mat.uniforms.uMorph.value = morph;
    mat.uniforms.uTime.value = reduce ? 0 : t;

    // Spin freely, then settle facing the viewer when the shield forms
    const settle = Math.min(1, Math.max(0, morph - 1.2) / 0.8);
    spin += dt * 0.32 * (1 - settle);
    const facing = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
    spin += (facing - spin) * 0.05 * settle;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    body.rotation.y = spin + pointer.x * 0.35 + Math.sin(t * 0.5) * 0.2 * settle;
    body.rotation.x = 0.18 * (1 - settle) + pointer.y * 0.2;

    renderer.render(scene, camera);
  }

  let raf = 0, visible = false;
  const loop = () => { render(); raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  if (reduce) {
    const once = () => render();
    addEventListener("scroll", once, { passive: true });
    new ResizeObserver(once).observe(canvas);
    once();
    return;
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }, { rootMargin: "100px" }).observe(section);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
