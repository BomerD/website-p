# bomerd.com

The website for Bomerd's games:

- **Okyay**, a puzzle game about clearing a board of arrows. Its policy is at `/privacy/`,
  which the app and Play link to.
- **Shard Kingdom: Color Defense**, a color defense game about firing the right gems at glass
  crystals. Its policy is at `/shard-kingdom/privacy/`, which Play links to.

Files:

- `index.html` — landing page listing both games
- `privacy/index.html` — Okyay's privacy policy, served at `/privacy/`
- `shard-kingdom/privacy/index.html` — Shard Kingdom's privacy policy,
  served at `/shard-kingdom/privacy/`
- `images/` — the game icons shown on the landing page
- `app-ads.txt` — AdMob's authorised-sellers file. One AdMob account (one publisher ID) serves both games' ads,
  so its one line covers both; each game's Play listing must give bomerd.com as its website

Each game has its own privacy policy because each Play listing points to one,
and each must match that app's Data safety form. Keep them separate.

Static HTML, no build step and no dependencies. Open `index.html` in a browser
to view it locally.

Served by GitHub Pages at [bomerd.com](https://bomerd.com).

---

Questions or anything wrong on these pages: bomerrd@gmail.com
