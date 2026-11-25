/* Runs before first paint: enables JS-driven styles and decides the intro. */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("cg-intro") === "1"; } catch (e) {}
  if (!reduce && !seen) root.classList.add("intro");
  // Failsafe: never leave content hidden if scripts fail to load.
  setTimeout(function () {
    if (!root.classList.contains("is-loaded")) root.classList.add("is-loaded"), root.classList.remove("intro");
  }, 5000);
})();
