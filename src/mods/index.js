/* Loads the Toolkit mods inside the app. Order matters: catalogue, loader, then every mod, then start. */
import "./shim.js";
import "./meta.js";
import "./loader.js";
import "./ceremony.js";
import "./imdb-photos.js";
import "./negotiations.js";
import "./brand-deals.js";
import "./advance-reviews.js";
import "./cinema-theme.js";
import "./ceremony.css";

// Same job as the extension's core/boot.js: start once the game page is up (its title starts with "Studio GM").
let tries = 0;
const attempt = () => {
  if (/^Studio GM/.test(document.title)) return void globalThis.SGM.start();
  if (++tries < 20) setTimeout(attempt, 500);
};
attempt();
