# ASCENT — Handyspiel

Turmsteigen im Querformat. Touch: Joystick links, Angriffe rechts.

## Am schnellsten: Netlify (Handy-Link)

1. Repo auf [Netlify](https://app.netlify.com) mit GitHub verbinden **oder** den `dist`-Ordner auf [Netlify Drop](https://app.netlify.com/drop) ziehen (nach `npm run build`).
2. Du bekommst eine Adresse wie `https://irgendwas.netlify.app`
3. Die auf dem **Handy** öffnen, quer halten, optional zum Home-Bildschirm legen.

Build-Einstellungen (wenn Netlify das Repo baut): Command `npm run build`, Publish `dist`. Liegt schon in `netlify.toml`.

## GitHub Pages

Nach dem Merge auf `main`:

1. GitHub → Repo → **Settings → Pages**
2. Build and deployment → Source: **GitHub Actions**
3. Einmal den Workflow *GitHub Pages* laufen lassen (passiert automatisch bei Push auf `main`)

Die Adresse wird dann so aussehen: `https://xiro-96.github.io/Game/`

## Lokal (nur zum Entwickeln)

```bash
npm install
npm run dev
```

Network-URL aus dem Terminal auf dem Handy öffnen (gleiches WLAN). `localhost` funktioniert auf dem Handy nicht.
