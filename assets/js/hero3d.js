/* CyberGuards – AI: hero scene.
   A black-metal shield with a glowing red G, inside a particle perimeter that a red
   ring keeps scanning. Red sparks (attacks) fly in and die on the perimeter. */
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.querySelector(".hero__canvas");
const hero = document.querySelector(".hero");
if (canvas && hero) init();

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // ---------- Studio environment for the metal (white softbox + red side panels) ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const panel = (w, h, color, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    envScene.add(m);
  };
  panel(8, 3, new THREE.Color(5, 5, 5), 0, 6, 1, Math.PI / 2);          // key softbox above
  panel(1.2, 7, new THREE.Color(6, 0.35, 0.5), -6, 0, -1, 0, Math.PI / 2); // red strip left
  panel(1.2, 7, new THREE.Color(5, 0.3, 0.45), 6, 0, -2, 0, -Math.PI / 2); // red strip right
  panel(6, 0.4, new THREE.Color(1.6, 1.6, 1.6), 0, -2.5, 6);           // low front fill
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;

  // ---------- Shield ----------
  const world = new THREE.Group();
  scene.add(world);
  const shield = new THREE.Group();
  world.add(shield);

  const OUTER = [[-1, 1.21], [1, 1.21], [1, -0.29], [0, -1.25], [-1, -0.29]];
  const INNER = [[-0.8, 1.01], [0.8, 1.01], [0.8, -0.205], [0, -0.973], [-0.8, -0.205]];

  const frameShape = rounded(OUTER, 0.07, new THREE.Shape());
  frameShape.holes.push(rounded(INNER, 0.05, new THREE.Path()));
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.34, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 6, curveSegments: 10,
  });
  frameGeo.translate(0, 0, -0.17);
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0x111111, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.35,
  });
  shield.add(new THREE.Mesh(frameGeo, metal));

  const plateGeo = new THREE.ExtrudeGeometry(rounded(INNER, 0.05, new THREE.Shape()), { depth: 0.06, bevelEnabled: false });
  plateGeo.translate(0, 0, -0.14);
  const plate = new THREE.Mesh(
    plateGeo,
    new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.7, roughness: 0.38, envMapIntensity: 0.6 })
  );
  shield.add(plate);

  // The G: an emissive red tube following the logo glyph
  const G = [[0.542, 0.792], [-0.542, 0.792], [-0.542, -0.208], [0, -0.708], [0.542, -0.208], [0.542, 0.208], [0.042, 0.208]];
  const gPath = new THREE.CurvePath();
  for (let i = 0; i < G.length - 1; i++) {
    gPath.add(new THREE.LineCurve3(new THREE.Vector3(G[i][0], G[i][1], 0), new THREE.Vector3(G[i + 1][0], G[i + 1][1], 0)));
  }
  const red = new THREE.Color(0xff2d3d);
  const glowMat = new THREE.MeshBasicMaterial({ color: red, toneMapped: false });
  const gTube = new THREE.Mesh(new THREE.TubeGeometry(gPath, 420, 0.05, 14, false), glowMat);
  gTube.position.z = -0.02;
  shield.add(gTube);
  for (const p of [G[0], G[G.length - 1]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), glowMat);
    cap.position.set(p[0], p[1], -0.02);
    shield.add(cap);
  }

  // Soft red bloom behind the glyph
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: radialTexture(), color: red, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.scale.set(3.6, 3.6, 1);
  glow.position.z = -0.35;
  shield.add(glow);

  const gLight = new THREE.PointLight(0xff2d3d, 2.2, 4, 1.4);
  gLight.position.set(0, 0.1, 1.1);
  shield.add(gLight);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff2d3d, 3);
  rim.position.set(4, -1, -3);
  scene.add(rim);

  // ---------- Perimeter: particle sphere scanned by a red band ----------
  const R = 2.35;
  const COUNT = small ? 1600 : 3200;
  const pos = new Float32Array(COUNT * 3);
  const rnd = new Float32Array(COUNT);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    const j = R * (1 + (Math.random() - 0.5) * 0.035);
    pos.set([Math.cos(t) * r * j, y * j, Math.sin(t) * r * j], i * 3);
    rnd[i] = Math.random();
  }
  const perimeterGeo = new THREE.BufferGeometry();
  perimeterGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  perimeterGeo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
  const perimeterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScan: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uReveal: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uScan, uPixel, uReveal;
      attribute float aRand;
      varying float vAlpha, vHit;
      void main() {
        vec3 p = position * (1.0 + 0.012 * sin(uTime * 0.9 + aRand * 6.2831));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float band = 1.0 - smoothstep(0.0, 0.16, abs(p.y - uScan));
        vHit = band;
        float front = smoothstep(-11.0, -6.6, mv.z);
        float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aRand * 40.0);
        vAlpha = (0.08 + front * 0.6) * twinkle * smoothstep(aRand * 0.6, aRand * 0.6 + 0.4, uReveal);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.3 + band * 2.4) * uPixel * (9.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha, vHit;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d) * vAlpha;
        vec3 col = mix(vec3(0.82), vec3(1.0, 0.18, 0.24), vHit);
        gl_FragColor = vec4(col, a * (1.0 + vHit * 1.6));
      }`,
  });
  const perimeter = new THREE.Points(perimeterGeo, perimeterMat);
  world.add(perimeter);

  // ---------- Orbits ----------
  const ring = (radius, color, opacity, dashed) => {
    const pts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.06, gapSize: 0.1, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
  };
  const orbitA = new THREE.Group();
  orbitA.rotation.set(1.18, 0.2, -0.28);
  const ringA = ring(2.85, 0xff2d3d, 0.55, false);
  orbitA.add(ringA);
  const sentinel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  orbitA.add(sentinel);
  world.add(orbitA);

  const orbitB = new THREE.Group();
  orbitB.rotation.set(1.42, -0.5, 0.4);
  orbitB.add(ring(3.25, 0xffffff, 0.16, true));
  world.add(orbitB);

  // ---------- Attacks: red sparks blocked at the perimeter ----------
  const THREATS = small ? 36 : 72;
  const tDir = new Float32Array(THREATS * 3);
  const tSpeed = new Float32Array(THREATS);
  const tOff = new Float32Array(THREATS);
  for (let i = 0; i < THREATS; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    tDir.set([Math.cos(a) * s, u, Math.sin(a) * s], i * 3);
    tSpeed[i] = 0.08 + Math.random() * 0.12;
    tOff[i] = Math.random();
  }
  const threatGeo = new THREE.BufferGeometry();
  threatGeo.setAttribute("position", new THREE.BufferAttribute(tDir, 3));
  threatGeo.setAttribute("aSpeed", new THREE.BufferAttribute(tSpeed, 1));
  threatGeo.setAttribute("aOff", new THREE.BufferAttribute(tOff, 1));
  const threatMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uR: { value: R }, uReveal: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPixel, uR, uReveal;
      attribute float aSpeed, aOff;
      varying float vA, vImpact;
      void main() {
        float t = fract(uTime * aSpeed + aOff);
        float k = clamp(t / 0.82, 0.0, 1.0);
        float r = mix(7.5, uR * 1.01, k * k);
        vImpact = smoothstep(0.8, 0.84, t) * (1.0 - smoothstep(0.84, 1.0, t));
        vA = smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(0.92, 1.0, t)) * uReveal;
        vec4 mv = modelViewMatrix * vec4(position * r, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min((2.2 + vImpact * 20.0) * uPixel * (9.0 / max(-mv.z, 0.1)), 40.0 * uPixel);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA, vImpact;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        float ringA = smoothstep(0.5, 0.42, d) * smoothstep(0.28, 0.4, d) * vImpact;
        vec3 col = mix(vec3(1.0, 0.16, 0.22), vec3(1.0, 0.75, 0.75), ringA);
        gl_FragColor = vec4(col, (core * (1.0 - vImpact * 0.7) + ringA) * vA);
      }`,
  });
  world.add(new THREE.Points(threatGeo, threatMat));

  // ---------- Layout ----------
  let layout = { x: 0, y: 0, s: 1 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (camera.aspect > 1.05) {
      const s = Math.min(0.92, (halfH * 0.86) / 3.25);
      layout = { x: halfW * 0.46, y: -halfH * 0.02, s };
    } else {
      const s = Math.min(0.8, (halfW * 1.08) / 3.25);
      layout = { x: 0, y: halfH * 0.04, s };
    }
    perimeterMat.uniforms.uPixel.value = threatMat.uniforms.uPixel.value = renderer.getPixelRatio();
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

  function render() {
    const t = clock.getElapsedTime();
    const intro = introStart === null ? 0 : Math.min(1, (performance.now() - introStart) / 2200);
    const e = reduce ? 1 : easeOut(intro);
    const scroll = Math.min(1.2, scrollY / innerHeight);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    world.position.set(layout.x, layout.y + scroll * 0.6, 0);
    world.scale.setScalar(layout.s * (0.86 + 0.14 * e) * (1 - scroll * 0.12));

    shield.rotation.y = (1 - e) * -2.4 + Math.sin(t * 0.45) * 0.22 + pointer.x * 0.45 + scroll * 1.1;
    shield.rotation.x = Math.sin(t * 0.33) * 0.06 + pointer.y * 0.22;
    shield.position.y = Math.sin(t * 0.8) * 0.05;
    shield.scale.setScalar(0.4 + 0.6 * e);

    perimeter.rotation.y = t * 0.05;
    perimeter.rotation.x = pointer.y * 0.08;
    perimeterMat.uniforms.uTime.value = t;
    perimeterMat.uniforms.uScan.value = Math.sin(t * 0.55) * R * 0.98;
    perimeterMat.uniforms.uReveal.value = e;
    threatMat.uniforms.uTime.value = t;
    threatMat.uniforms.uReveal.value = e;

    orbitA.rotation.z = -0.28 + t * 0.12;
    const s = t * 0.7;
    sentinel.position.set(Math.cos(s) * 2.85, 0, Math.sin(s) * 2.85);
    orbitB.rotation.z = 0.4 - t * 0.05;
    ringA.material.opacity = 0.55 * e;
    orbitB.children[0].material.opacity = 0.16 * e;
    glow.material.opacity = (0.45 + Math.sin(t * 1.6) * 0.08) * e;
    gLight.intensity = 2.2 * e;

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
    render();
    new ResizeObserver(() => render()).observe(canvas);
    return;
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
}

// ---------- Helpers ----------
function rounded(pts, r, path) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1 = norm([p0[0] - p1[0], p0[1] - p1[1]]);
    const v2 = norm([p2[0] - p1[0], p2[1] - p1[1]]);
    const a = [p1[0] + v1[0] * r, p1[1] + v1[1] * r];
    const b = [p1[0] + v2[0] * r, p1[1] + v2[1] * r];
    if (i === 0) path.moveTo(a[0], a[1]); else path.lineTo(a[0], a[1]);
    path.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  path.closePath();
  return path;
}
function norm(v) { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; }

function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
