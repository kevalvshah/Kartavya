# frontend/src/

React 18 app (Create React App + craco). Deployed on Vercel.

## Entry points

| File | Role |
|---|---|
| `index.js` | ReactDOM.render — do not touch unless changing React root behaviour |
| `App.js` | Route tree + lazy imports + ToastProvider. **No business logic here.** Add new routes here and nowhere else. |

## Folder map

```
frontend/src/
├── App.js                  ← Route tree only (touch when: adding a new page route)
├── index.js                ← ReactDOM root (touch when: adding a global provider like Redux)
├── App.css                 ← Legacy global styles being phased out — prefer styles/ or tokens.css
│
├── pages/                  ← One file per route (see pages/README.md)
├── components/             ← Shared UI components (see components/README.md)
├── hooks/                  ← Custom React hooks (see hooks/README.md)
├── lib/                    ← Non-React utilities: API client, auth, tokens, brand (see lib/README.md)
└── styles/                 ← Global CSS files imported in App.js (see styles/README.md)
```

## Import rules

Imports always go **down** the tree, never sideways across top-level folders
except through `lib/`:

```
pages → components → lib
pages → hooks → lib
pages → lib
components → lib
```

Never import a page from a component. Never import a hook from a component
unless the hook lives in `hooks/`. Never do relative `../../` imports that
cross a folder boundary — use path aliases if needed.

## Adding a new page

1. Create `frontend/src/pages/YourPage.jsx`
2. Add it to the lazy import block and route tree in `App.js`
3. If it needs a teamId from context, use `useOutletContext()` — see
   existing wrapper pattern in `App.js`
4. Add a row to `pages/README.md`

## Cross-folder rules

| When you touch… | Also check… |
|---|---|
| `App.js` route tree | `components/layout/Sidebar.jsx` nav links must match |
| `App.js` route tree | `components/layout/AppShell.jsx` `teamId` extraction regex |
| `lib/api.js` base URL | `.env.production`, Vercel env vars |
| `lib/auth.js` | `components/layout/Protected.jsx`, `components/layout/AuthShell.jsx` |
| `lib/tokens.css` | Any component using CSS variables — visual regression test |
| `styles/` any file | `App.js` import list at the top |
