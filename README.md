# Global Renewable Electricity Dashboard

Interactive dashboard for the Handshake AI Skills Studio mission **“Turn Data into an Interactive Dashboard.”**

## Public data only

The dashboard uses the public Our World in Data dataset:

**Electricity generation from renewables**, annual, measured in TWh.

OWID dataset page:
https://ourworldindata.org/grapher/electricity-mix?frequency=annual&metric=generation&source=renewables&tab=line

CSV endpoint:
https://ourworldindata.org/grapher/electricity-mix.csv?v=1&csvType=full&useColumnShortNames=false&source=renewables&metric=generation&frequency=annual

The dataset page currently reports coverage from 1900–2025 and a June 30, 2026 update. Renewables include solar, wind, hydropower, bioenergy, geothermal, wave and tidal.

## Dashboard questions

1. How has renewable electricity generation changed globally over time?
2. How does renewable electricity generation differ across countries, and how has that changed over time?

## Files

- `index.html` — dashboard page
- `style.css` — responsive styling
- `app.js` — data loading, controls, charts and map
- `README.md` — project notes

## Run locally

Because the page fetches the public CSV from OWID, serve the folder through a simple web server rather than opening `index.html` directly.

Example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

This is a static site. It can be deployed to GitHub Pages, Netlify, Vercel static hosting, or another static web host.

No server-side environment variables are required.

## Data/privacy

No personal data, personal files, private account information, or connected personal services are used.
