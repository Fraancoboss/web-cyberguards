/* CyberGuards – AI: motion and interaction layer (GSAP + ScrollTrigger + SplitText + Lenis). */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  const nav = document.querySelector(".nav");

  // ---------- Mobile menu ----------
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".sr-only").textContent = open ? "Cerrar menú" : "Abrir menú";
    root.classList.toggle("menu-open", open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("is-open"));
      window.cgLenis?.stop();
    } else {
      menu.classList.remove("is-open");
      window.cgLenis?.start();
      setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, reduce ? 0 : 700);
    }
  };
  if (toggle && menu) {
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); } });
  }
  const done = () => root.classList.add("is-loaded");
  const signalHero = () => window.dispatchEvent(new CustomEvent("cg:hero"));

  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove("intro");
    done();
    signalHero();
    return;
  }

  const { gsap, ScrollTrigger, SplitText } = window;
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);

  // ---------- Smooth scroll ----------
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.cgLenis = lenis;
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? document.body : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      if (lenis) lenis.scrollTo(id === "#top" ? 0 : target, { offset: -margin, duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
      else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      if (id !== "#top" && target.matches("section, article")) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    });
  });

  // ---------- Nav state ----------
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle("is-solid", y > 24);
      nav.classList.toggle("is-hidden", self.direction === 1 && y > window.innerHeight * 0.6);
    },
  });

  // ---------- Reduced motion: show everything, wire the few stateful bits ----------
  if (reduce) {
    done();
    signalHero();
    stateful();
    return;
  }

  document.fonts.ready.then(() => {
    const split = (sel, type) =>
      SplitText ? SplitText.create(sel, { type, mask: type === "lines" ? "lines" : undefined, linesClass: "line", wordsClass: "word", charsClass: "char" }) : null;

    // ---------- Intro + hero ----------
    const heroSplit = split(".hero__title", "lines");
    const intro = root.classList.contains("intro");
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

    if (intro) {
      tl.to(".loader__frame", { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" })
        .to(".loader__g", { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, "-=0.45")
        .to(".loader__label", { opacity: 1, duration: 0.5, ease: "power1.out" }, "-=0.6")
        .to(".loader__mark", { scale: 1.08, duration: 0.5, ease: "power2.in" }, "+=0.1")
        .to(".loader", { clipPath: "inset(0 0 100% 0)", duration: 1, ease: "expo.inOut" }, "-=0.1")
        .add(() => {
          root.classList.remove("intro");
          try { sessionStorage.setItem("cg-intro", "1"); } catch (e) {}
        });
      gsap.set(".loader", { clipPath: "inset(0 0 0% 0)" });
    }

    tl.add(signalHero, intro ? "-=0.85" : 0);
    if (heroSplit) tl.from(heroSplit.lines, { yPercent: 115, duration: 1.3, stagger: 0.09 }, intro ? "-=0.6" : 0.1);
    tl.from(".hero [data-fade]", { y: 18, opacity: 0, duration: 1.1, stagger: 0.09 }, "-=1")
      .fromTo(nav, { y: -16, opacity: 0, transition: "none" }, { y: 0, opacity: 1, duration: 1, clearProps: "transform,opacity,transition" }, "<");
    done();

    // ---------- Section headings ----------
    document.querySelectorAll("[data-lines]").forEach((el) => {
      const s = split(el, "lines");
      if (!s) return;
      gsap.from(s.lines, {
        yPercent: 115,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    });

    // ---------- Manifesto: words light up as you read ----------
    const manifesto = document.querySelector("[data-words]");
    if (manifesto) {
      const s = split(manifesto, "words");
      if (s) {
        gsap.fromTo(
          s.words,
          { opacity: 0.14 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.06,
            scrollTrigger: { trigger: manifesto, start: "top 78%", end: "bottom 42%", scrub: 0.6 },
          }
        );
      }
    }

    // ---------- Method: the red line advances step by step ----------
    const steps = gsap.utils.toArray(".step");
    gsap.to(".method__progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: ".method__steps",
        start: "top 80%",
        end: "bottom 55%",
        scrub: 0.5,
        onUpdate(self) {
          steps.forEach((step, i) => step.classList.toggle("is-on", self.progress >= i / steps.length + 0.02));
        },
      },
    });
    gsap.from(".step", {
      y: 24,
      opacity: 0,
      duration: 1,
      ease: "expo.out",
      stagger: 0.1,
      scrollTrigger: { trigger: ".method__steps", start: "top 85%", once: true },
    });

    // ---------- Stakes: numbers count up ----------
    document.querySelectorAll("[data-count]").forEach((el) => {
      const end = Number(el.dataset.count);
      const obj = { v: 0 };
      el.textContent = "0";
      gsap.to(obj, {
        v: end,
        duration: 1.8,
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: () => (el.textContent = Math.round(obj.v)),
      });
    });
    gsap.from(".stake", {
      opacity: 0,
      y: 20,
      duration: 1,
      ease: "expo.out",
      stagger: 0.12,
      scrollTrigger: { trigger: ".stakes__grid", start: "top 85%", once: true },
    });

    // ---------- Principles ----------
    gsap.from(".principles__list li", {
      opacity: 0,
      x: 24,
      duration: 1,
      ease: "expo.out",
      stagger: 0.1,
      scrollTrigger: { trigger: ".principles__list", start: "top 85%", once: true },
    });

    // ---------- CTA glow breathes in ----------
    gsap.from(".cta__glow", {
      opacity: 0,
      scale: 0.7,
      ease: "none",
      scrollTrigger: { trigger: ".cta", start: "top bottom", end: "center center", scrub: true },
    });

    // ---------- Footer wordmark rises out of the baseline ----------
    gsap.from(".footer__word", {
      yPercent: 45,
      clipPath: "inset(0 0 100% 0)",
      duration: 1.6,
      ease: "expo.out",
      scrollTrigger: { trigger: ".footer__mark", start: "top 92%", once: true },
    });

    stateful();
    ScrollTrigger.refresh();
  });

  // ---------- Behaviour that is not decorative motion ----------
  function stateful() {
    // Active service + stage index
    const panels = document.querySelectorAll(".service");
    const indexItems = document.querySelectorAll(".services__index li");
    panels.forEach((panel, i) => {
      ScrollTrigger.create({
        trigger: panel,
        start: "top 60%",
        end: "bottom 40%",
        onToggle(self) {
          if (!self.isActive) return;
          panels.forEach((p) => p.classList.toggle("is-active", p === panel));
          indexItems.forEach((li, j) => li.classList.toggle("is-active", j === i));
        },
      });
    });

    // Footer spotlight follows the pointer
    const mark = document.querySelector(".footer__mark");
    if (mark && finePointer) {
      const setX = gsap.quickTo(mark, "--mx", { duration: 0.6, ease: "power3.out" });
      const setY = gsap.quickTo(mark, "--my", { duration: 0.6, ease: "power3.out" });
      mark.addEventListener("pointermove", (e) => {
        const r = mark.getBoundingClientRect();
        setX(((e.clientX - r.left) / r.width) * 100 + "%");
        setY(((e.clientY - r.top) / r.height) * 100 + "%");
      });
    } else if (mark && !reduce) {
      gsap.fromTo(mark, { "--mx": "0%" }, { "--mx": "100%", duration: 6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }

    // Magnetic buttons
    if (finePointer && !reduce) {
      document.querySelectorAll("[data-magnetic]").forEach((btn) => {
        const x = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
        const y = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
        btn.addEventListener("pointermove", (e) => {
          const r = btn.getBoundingClientRect();
          x((e.clientX - r.left - r.width / 2) * 0.22);
          y((e.clientY - r.top - r.height / 2) * 0.3);
        });
        btn.addEventListener("pointerleave", () => { x(0); y(0); });
      });
    }
  }
})();
