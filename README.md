# AI Lead Hunter OS

Personal AI-powered lead system for web development agencies.

**Discover → Import → Score → Audit → Outreach → Pipeline**

Vanilla HTML/CSS/JS SPA. Data in LocalStorage. API-ready placeholders. No build step.

---

## Quick start

```bash
cd AI-Lead-Hunter-OS
python -m http.server 5500
```

Open **http://localhost:5500**

> ES modules require HTTP (not `file://`).

---

## GitHub Pages

1. Push this folder to a GitHub repo (root of the repo or a subfolder).
2. **Settings → Pages → Source:** branch `main`, folder `/` (or the subfolder path).
3. Open the published URL.

All asset paths are relative (`css/`, `js/`, `data/`).

---

## Features

- **Dashboard** — metrics, conversion, score distribution, top opportunities  
- **Leads CRM** — CRUD, search, filters, mobile cards  
- **Discovery** — niche/city search (demo mode without API keys)  
- **Scoring** — explainable 0–100 scores  
- **Website audit** — structured opportunity report  
- **Outreach** — email, WhatsApp, LinkedIn, follow-ups  
- **Pipeline** — New → Won/Lost kanban  
- **Settings** — profile, CSV export, JSON backup/import  

---

## Project structure

```
AI-Lead-Hunter-OS/
├── index.html
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── api-config.js
│   ├── storage.js
│   ├── dashboard.js
│   ├── leads.js
│   ├── discovery.js
│   ├── scoring.js
│   ├── audit.js
│   ├── outreach.js
│   └── settings.js
├── data/
│   └── sample-leads.json
├── assets/
│   ├── icons/
│   └── images/
├── .gitignore
└── README.md
```

---

## API keys (optional)

Edit `js/api-config.js` — leave empty for local demo mode:

```js
SEARCH_PROVIDER = ""
SEARCH_API_KEY = ""
SEARCH_ENDPOINT = ""
AI_API_KEY = ""
PAGESPEED_API_KEY = ""
FEATURES.useRealAI = false
FEATURES.usePageSpeed = false
FEATURES.enableAutoDiscovery = false
```

Never commit real keys.

---

## Daily workflow

1. **Discovery** — search niche + city → import  
2. **Leads** — review, edit, set follow-up  
3. **Audit** — run from lead detail  
4. **Outreach** — generate & copy messages  
5. **Pipeline** — move stages  
6. **Settings** — export CSV / backup JSON  

---

## License

Use freely for your agency. No warranty.
