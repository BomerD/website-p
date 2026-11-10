# bomerd.com

The website for Bomerd's games:

- **Okyay**, a puzzle game about clearing a board of arrows. Its policy is at `/privacy/`,
  which the app and Play link to.
- **Shard Kingdom: Color Defense**, a color defense game about firing the right gems at glass
  crystals. Its policy is at `/shard-kingdom/privacy/`, which Play links to.

Files:

- `index.html` — landing page listing both games (Shard Kingdom first), and the site's name for Google
  (schema.org `WebSite` data: "Bomerd")
- `privacy/index.html` — Okyay's privacy policy, served at `/privacy/`
- `shard-kingdom/privacy/index.html` — Shard Kingdom's privacy policy,
  served at `/shard-kingdom/privacy/`
- `shard-kingdom/index.html` — Shard Kingdom's own page, served at `/shard-kingdom/`: what Google should show for
  "Shard Kingdom" (its title, description and schema.org data name the game). Since 2026-11-10 laid out like a
  mobile game's site, in the game's own look: a hero with
  a stage that plays the game (below), the screens in phones and the trailer (loading from YouTube only when
  tapped), how it plays, the five gems, the three guns and their looks, the six worlds and the two endless modes,
  the Keeper's wardrobe, the abilities, the daily rewards, questions people search for ("is it free", "is it on
  iPhone"), and the call to play. It travels Dawn to Abyss as it scrolls, as the game does world by world.
- `assets/site.css` — every page's look, from the game's DESIGN.md and ui/style.gd: each world's palette as a
  class (`.w-dawn` … `.w-abyss`; `.w-auto` is Dawn, or the Abyss in dark mode, for the pages to read), Outfit,
  titles in letter-spaced capitals, paper tiles on a thicker edge, ink capsules. No gem color is used for the page's
  own buttons or links: players read gem colors as ammo.
- `assets/fonts/outfit.woff2` — the game's font (Outfit, SIL OFL, `OFL.txt` beside it), cut to Latin
- `assets/stage.js` — the game page's stage: each world's backdrop is the game's own render, and the crystals on it
  are drawn with the game's projection and numbers (world/view.gd, entities/enemy.gd), fading into the fog beyond
  the range line. It plays by itself; the gem buttons under it fire at the closest crystal of their color, a wrong
  one misses. It moves on to the next world once a road is cleared, and sleeps off screen
- `images/shard-kingdom/worlds/`, `images/shard-kingdom/art/` — the game's art, drawn by the game's own code (not
  redrawn): each world's battlefield (the stage's backdrops, and a strip of it for the worlds' cards), slices of the
  screenshots (the home page), the five gems, the guns at their looks, the Keeper in each set, the menus' icons.
  Rendered by the game project's `tools/site_art.gd` (then `tools/site_art.py`), building the world in an offscreen viewport (Field, Scenery, Wall,
  Shooter with View; `Draw.gem`, `Shooter.draw_family()`, `Keeper.draw()`, `Icons.draw_any()`), run windowed; render
  again the same way when the game's look changes
- `shard-kingdom/get.js` — every Google Play button on the site (`<a data-play>`; see `play/` below); a page loads
  it with its own `data-campaign`, which Play Console's acquisition report shows
- `robots.txt`, `sitemap.xml` — for search engines: every page meant for search results is in the sitemap (with the
  game's screenshots, for image search), and the sitemap is submitted in Google Search Console
- `404.html` — what GitHub Pages shows for an address with nothing at it: links back into the site (never indexed)
- `favicon.ico`, `apple-touch-icon.png` — the site's icon (Shard Kingdom's), which Google shows beside every
  bomerd.com result: Google takes one icon per site, from the home page
- `shard-kingdom/play/index.html` — Shard Kingdom's Google Play button, served at `/shard-kingdom/play/`:
  the link in its social profiles and posts (`?utm_source=instagram&utm_campaign=bio`, passed on to Play as the
  install referrer). Instagram's and Facebook's own browsers on Android do nothing with a play.google.com link, so
  its button opens the Play Store app itself (`market://`), and says how to open the page in Chrome if that fails.
  Kept out of search results (`noindex`) and the sitemap, so Google shows the game's own page for "Shard Kingdom"
- `images/` — the game icons shown on the landing page, Shard Kingdom's feature graphic (the PNG for link
  previews, the WebP for the Play page's banner) and Google's Get it on Google Play badge (Google's file, never
  redrawn or recolored)
- `app-ads.txt` — AdMob's authorised-sellers file. One AdMob account (one publisher ID) serves both games' ads,
  so its one line covers both; each game's Play listing must give bomerd.com as its website

Each game has its own privacy policy because each Play listing points to one,
and each must match that app's Data safety form. Keep them separate.

Every page but the home page starts with a breadcrumb (Bomerd › Shard Kingdom › Privacy policy, also in its
schema.org data), and every page ends with the same site map (each game's page, Play link and policy; contact;
the profiles), so any page is a tap from any other. Links inside the site start at the root (`/shard-kingdom/`).

Static HTML, CSS and a little JavaScript: no build step and no dependencies. Links start at the root, so view it through a local server, not
by opening the file: `python3 -m http.server` in this folder, then http://localhost:8000/.

Served by GitHub Pages at [bomerd.com](https://bomerd.com).

---

Questions or anything wrong on these pages: bomerrd@gmail.com
