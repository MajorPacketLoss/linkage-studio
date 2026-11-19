"use strict";
(() => {
  const storageKey = "linkage-studio-appearance";
  const defaults = {
    theme: "system", accent: "#235f99", canvas: "#fbfcfe", autoCanvas: true,
    link1: "#2467ad", link2: "#16776d", link3: "#75518f",
    link4: "#a16830", link5: "#a34a62", link6: "#657c28",
    wheel: "#416e9e", rope: "#665649"
  };
  const get = id => document.getElementById(id);
  const root = document.documentElement;
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const validColor = value => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  let preferences = {...defaults}, storageAvailable = true;
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey));
    if (saved && typeof saved === "object") {
      for (const key of Object.keys(defaults)) {
        if (key === "theme" ? ["light", "dark", "system"].includes(saved[key]) : key === "autoCanvas" ? typeof saved[key] === "boolean" : validColor(saved[key])) {
          preferences[key] = saved[key];
        }
      }
    }
  } catch { storageAvailable = false; }

  function luminance(color) {
    const rgb = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
    const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }
  function apply() {
    const dark = preferences.theme === "dark" || preferences.theme === "system" && media?.matches;
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.style.setProperty("--accent", preferences.accent);
    root.style.setProperty("--accent-text", luminance(preferences.accent) > .179 ? "#172438" : "#ffffff");
    const canvas = preferences.autoCanvas ? dark ? "#15202e" : defaults.canvas : preferences.canvas;
    root.style.setProperty("--canvas", canvas);
    get("appCanvas").value = canvas;
    const darkCanvas = luminance(canvas) < .179;
    root.style.setProperty("--canvas-ink", darkCanvas ? "#e2ebf5" : "#1c2d42");
    root.style.setProperty("--canvas-muted", darkCanvas ? "#a0b5cb" : "#596f87");
    root.style.setProperty("--canvas-grid", darkCanvas ? "#ffffff18" : "#00000012");
    root.style.setProperty("--canvas-axis", darkCanvas ? "#ffffff38" : "#00000030");
    for (let i = 1; i <= 6; i++) root.style.setProperty("--link-" + i, preferences["link" + i]);
    root.style.setProperty("--wheel-color", preferences.wheel);
    root.style.setProperty("--rope-color", preferences.rope);
  }
  function sync() {
    get("appTheme").value = preferences.theme;
    get("appAccent").value = preferences.accent;
    if (!preferences.autoCanvas) get("appCanvas").value = preferences.canvas;
    get("appCanvasAutomatic").checked = preferences.autoCanvas;
    get("appCanvas").disabled = preferences.autoCanvas;
    for (const input of document.querySelectorAll("[data-appearance-color]")) input.value = preferences[input.dataset.appearanceColor];
  }
  function save() {
    apply();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
      storageAvailable = true;
    } catch { storageAvailable = false; }
    get("appearanceStatus").textContent = storageAvailable ? "Appearance saved on this browser." : "Appearance applied for this session. Browser storage is unavailable.";
  }
  get("appearanceOpen").onclick = () => {
    sync();
    get("appearanceStatus").textContent = storageAvailable ? "" : "Browser storage is unavailable; changes apply for this session.";
    get("appearanceDialog").showModal();
  };
  get("appearanceClose").onclick = () => get("appearanceDialog").close();
  get("appTheme").onchange = event => {
    if (!["light", "dark", "system"].includes(event.target.value)) return;
    preferences.theme = event.target.value;
    save();
  };
  for (const [id, key] of [["appAccent", "accent"], ["appCanvas", "canvas"]]) {
    get(id).oninput = event => {
      if (!validColor(event.target.value)) return;
      preferences[key] = event.target.value;
      save();
    };
  }
  for (const input of document.querySelectorAll("[data-appearance-color]")) input.oninput = event => {
    if (!validColor(event.target.value)) return;
    preferences[input.dataset.appearanceColor] = event.target.value;
    save();
  };
  get("appCanvasAutomatic").onchange = event => {
    preferences.autoCanvas = event.target.checked;
    get("appCanvas").disabled = preferences.autoCanvas;
    save();
  };
  get("appearanceReset").onclick = () => { preferences = {...defaults}; sync(); save(); };
  if (media?.addEventListener) media.addEventListener("change", apply);
  else media?.addListener?.(apply);
  apply();
  sync();
})();
