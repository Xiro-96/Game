import { Game } from "./game.js";

window.addEventListener("error", (e) => {
  console.error(e.error || e.message);
});

document.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

const lan = document.getElementById("lan-url");
if (lan) {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const playUrl = location.href.split("#")[0].replace(/index\.html$/, "");
  lan.textContent = local && __LAN_URL__ ? __LAN_URL__ : playUrl;
  document.getElementById("desk-local")?.classList.toggle("hidden", !local);
  document.getElementById("desk-hosted")?.classList.toggle("hidden", local);
}

if ("serviceWorker" in navigator) {
  const sw = new URL("sw.js", document.baseURI).pathname;
  navigator.serviceWorker.register(sw).catch(() => {});
}

async function lockLandscape() {
  try {
    await screen.orientation?.lock?.("landscape");
  } catch {
    /* Browser darf sperren, muss aber nicht */
  }
}

document.getElementById("btn-play")?.addEventListener("click", lockLandscape, { once: true });

let deferredPrompt = null;
const installBtn = document.getElementById("btn-install");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn?.classList.remove("hidden");
});
installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (ios && !standalone) {
  const hint = document.getElementById("touch-hint");
  if (hint) hint.textContent = "Teilen → Zum Home-Bildschirm · dann quer spielen";
}

new Game();
