import { Game } from "./game.js";

window.addEventListener("error", (e) => {
  console.error(e.error || e.message);
});

new Game();
