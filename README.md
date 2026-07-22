# 🛍️ Inventory Tracker

A full-stack **inventory management & theft-prevention** web app for boutique
stores. Workers scan item barcodes/QR codes with their phone or laptop camera;
the store owner gets an instant email and a private, PIN-protected dashboard
with live stock, low-stock alerts, and today's sales.

Each account is its own isolated store — **every account has a completely
separate inventory and dashboard** — and inventory can be built in seconds by
**uploading an Excel/CSV spreadsheet**.

---

## ✨ Features

- **Email / password authentication** — sign in or create an account.
- **Checkout email alerts** — every checkout emails the store's notification
  address, sent through an HTTP email API (Brevo / Resend) so it works even on
  hosts that block SMTP. Configured once on the server (see below).
- **Worker portal** with a live **camera barcode/QR scanner**, a **search bar**
  to find an item by name/barcode and tap to sell, plus manual entry. Every
  checkout updates stock and **emails the store owner**.
- **Owner portal** locked behind a **6-digit PIN** (customizable), showing:
  - Out-of-stock items
  - Low-stock alerts
  - Today's sales (count, units, revenue)
  - Total inventory value
- **Add / edit / delete items** and prices.
- **Quick +/- stock adjustment** with a stepper (set the amount, tap +/- to
  restock or correct) — every change is logged, and the dashboard shows
  today's stock added alongside today's sales.
- **📥 Excel / CSV import** — upload a spreadsheet and it instantly becomes your
  inventory (merge by barcode, or replace everything).
- **Per-account isolation (multi-tenant)** — accounts never see each other's data.
- **Settings** — change the PIN, change the notification email, toggle
  **dark / light theme**.
- **Bilingual UI — English / Amharic (አማርኛ)** — switch instantly with the
  **አማ / EN** button in the top bar (or Owner Portal → Settings → Language);
  the choice is remembered on the device.
- **Production-ready backend** — Helmet, CORS allow-listing, rate limiting,
  bcrypt-hashed passwords & PINs, JWT auth, Zod validation, parameterized SQL,
  centralized error handling, graceful shutdown.

---

## 🧱 Tech stack

| Layer     | Technology                                             |
|-----------|--------------------------------------------------------|
| Frontend  | React 18 + Vite, React Router, html5-qrcode            |
| Backend   | Node.js + Express                                      |
| Database  | libSQL / SQLite (local file in dev, hosted **Turso** in prod) |
| Auth      | JWT (jsonwebtoken) + bcryptjs                           |
| Email     | Nodemailer (SMTP)                                       |
| Import    | ExcelJS (.xlsx / .xls / .csv)                          |
| Security  | Helmet, express-rate-limit, CORS, Zod validation       |

---

## 📁 Project structure

```
Scan-safe/
├── package.json            # Root convenience scripts (install/dev/seed/build)
├── docs/
│   └── sample-inventory.csv # Example spreadsheet for the import feature
├── server/                 # Express API
│   ├── .env.example
│   └── src/
│       ├── index.js        # Entry point (+ graceful shutdown)
│       ├── app.js          # Express app, security middleware, routes
│       ├── config/         # env + database (schema bootstrap)
│       ├── models/         # Data access (users, items, scans, settings, admin)
│       ├── routes/         # auth, scan, owner, admin
│       ├── middleware/     # auth, owner-PIN, admin-auth, upload, error handler
│       ├── services/       # email + spreadsheet import
│       ├── validators/     # Zod schemas
│       ├── utils/          # ApiError, asyncHandler, validate
│       └── scripts/seed.js # Optional demo data
└── client/                 # React app
    ├── .env.example
    ├── index.html          # Loads the Telegram Web App SDK
    └── src/
        ├── main.jsx, App.jsx
        ├── api/client.js   # fetch wrapper + file upload
        ├── context/        # Auth + Theme + Language providers
        ├── i18n/           # English + Amharic UI translations
        ├── lib/telegram.js # Telegram Mini App integration (no-op outside Telegram)
        ├── components/      # Navbar, BarcodeScanner, owner/* tabs
        ├── pages/          # LoginPage, WorkerPortal, OwnerPortal, Admin*
        └── styles/index.css
```

---

## 🚀 Quick start (local)

> Requires **Node.js 18+**.

```bash
# 1. Install dependencies for both server and client
npm run install:all

# 2. Configure the backend
cp server/.env.example server/.env
#    -> open server/.env and set a strong JWT_SECRET (see below)

# 3. (optional) configure the frontend — defaults work for local dev
cp client/.env.example client/.env

# 4. (optional) seed demo data: a demo owner + sample items
npm run seed
#    Demo login: owner@example.com / password123   (owner PIN: 123456)

# 5. Run the backend (terminal 1)
npm run dev:server     # http://localhost:4000

# 6. Run the frontend (terminal 2)
npm run dev:client     # http://localhost:5173
```

Open **http://localhost:5173**, create an account, and you're in the worker
portal. Visit **Owner** and enter PIN **123456** (the default — change it in
Settings).

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> 📷 **Camera note:** browsers only allow camera access over **HTTPS** or on
> **localhost**. Scanning works locally out of the box; in production you must
> serve the site over HTTPS.

---

## 🔧 Environment variables

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | – | `development` or `production`. |
| `PORT` | – | API port (default `4000`). |
| `CLIENT_ORIGIN` | ✅ (prod) | Comma-separated allowed front-end origins for CORS. |
| `JWT_SECRET` | ✅ | Long random string used to sign login tokens. |
| `JWT_EXPIRES_IN` | – | Session lifetime (default `7d`). |
| `BREVO_API_KEY` | – | Enables notification emails via [Brevo](https://brevo.com)'s HTTPS API — email any recipient on an SMTP-blocked host (verify one sender, no domain). Requires `MAIL_FROM` set to the verified sender. |
| `DEFAULT_OWNER_PIN` | – | PIN assigned to each new account (default `123456`). |
| `ADMIN_PASSWORD` | – | Password for the app-wide Super Admin panel at `/admin` (default `0703`). Change this before deploying publicly. |
| `DATABASE_PATH` | – | Local SQLite file path used in dev when no Turso URL is set (default `./data/inventory.sqlite`). |
| `TURSO_DATABASE_URL` | ✅ (prod) | Hosted libSQL/Turso URL (`libsql://...`). Required in production for durable storage. |
| `TURSO_AUTH_TOKEN` | ✅ (prod) | Auth token for the Turso database. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | – | SMTP server for notifications. |
| `SMTP_USER` / `SMTP_PASS` | – | SMTP credentials. |
| `MAIL_FROM` | – | "From" address for notification emails. |

If SMTP is left blank, notification emails are **logged to the server console**
instead of being sent — handy for local development.

**Email over HTTPS (Brevo) — recommended for hosts that block SMTP.** Many free
hosting tiers (e.g. Render free) block outbound SMTP, so Gmail/SMTP can't
connect. [Brevo](https://brevo.com) sends over HTTPS (port 443, never blocked)
and, once configured, is used for all notifications. It can email **any
recipient** after verifying just one sender — no domain needed:

1. Sign up at [brevo.com](https://brevo.com).
2. Verify a single sender: **Senders, Domains & Dedicated IPs → Senders → Add a
   sender**, then click the confirmation link Brevo emails you.
3. Create a **v3 API key**: **SMTP & API → API Keys → Generate a new API key**
   (this is *not* the SMTP password).
4. Set **`BREVO_API_KEY`** to that key and **`MAIL_FROM`** to the exact verified
   sender (e.g. `Inventory Tracker <you@gmail.com>`), then redeploy.

Once configured, use the **Send test email** button in **Owner Portal →
Settings → Checkout notifications** to confirm delivery — it reports the exact
reason if the provider rejects the send.

### Frontend (`client/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the API. Leave **blank** locally (Vite proxies `/api` to `:4000`). In production set it to your API origin, e.g. `https://api.yourstore.com`. |

---

## 📥 Importing inventory from Excel / CSV

In **Owner Portal → Inventory → Import from Excel / CSV**, upload a `.xlsx`,
`.xls`, or `.csv` file. The moment it's uploaded it becomes your inventory.

- **Required columns:** `barcode`, `name`
- **Optional columns:** `price`, `quantity`, `low_stock_at`, `category`
- Headers are matched flexibly and case-insensitively. Common aliases work too,
  e.g. `UPC`/`EAN`/`code` → barcode, `Product`/`Item` → name, `Qty`/`Stock` →
  quantity, `Reorder`/`Threshold` → low_stock_at.
- **Replace existing inventory** wipes current items first (spreadsheet becomes
  the single source of truth). Unchecked, rows are merged by barcode (existing
  items updated, new ones added).

See [`docs/sample-inventory.csv`](docs/sample-inventory.csv) for a ready-to-use
example.

> 💡 **Barcodes with leading zeros:** in Excel, format the barcode column as
> **Text** so values like `0001112223334` keep their leading zeros. The CSV
> importer preserves them automatically.

---

## 🔌 API overview

All `/api/owner/*` routes require both a login token **and** an owner token
obtained by verifying the PIN at `POST /api/owner/unlock`.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | – | Create an account |
| `POST` | `/api/auth/login` | – | Sign in |
| `POST` | `/api/scan` | login | Scan/checkout a barcode (emails owner) |
| `GET`  | `/api/scan/lookup/:barcode` | login | Preview an item |
| `POST` | `/api/owner/unlock` | login | Verify PIN → owner token |
| `GET`  | `/api/owner/dashboard` | owner | Stock health + today's sales |
| `GET`/`POST` | `/api/owner/items` | owner | List / add items |
| `POST` | `/api/owner/items/import` | owner | Upload spreadsheet |
| `PATCH`/`DELETE` | `/api/owner/items/:id` | owner | Edit / delete item |
| `POST` | `/api/owner/items/:id/stock` | owner | Adjust stock by +/- N units (logged) |
| `GET` | `/api/owner/settings` | owner | Read settings |
| `PUT` | `/api/owner/settings/pin` | owner | Change PIN |
| `PUT` | `/api/owner/settings/notification-email` | owner | Change email |
| `PUT` | `/api/owner/settings/theme` | owner | Save theme |
| `POST` | `/api/owner/settings/notifications/test` | owner | Send a test notification email |
| `POST` | `/api/admin/login` | – | Verify admin password → admin token |
| `GET` | `/api/admin/overview` | admin | App-wide totals (all stores) |
| `GET` | `/api/admin/stores` | admin | Every registered store + snapshot |
| `DELETE` | `/api/admin/stores/:id` | admin | Remove a store and all its data |
| `GET` | `/api/health` | – | Health check |

---

## 🛡️ Super Admin panel

A separate, app-wide admin area at **`/admin/login`** (linked from the bottom
of the sign-in page) lets the operator see every registered store at a
glance — total items, inventory value, and today's sales per store. It is
completely independent of any individual store's account login or Owner PIN.

- Default password: **`0703`**. Override it with the `ADMIN_PASSWORD`
  environment variable (strongly recommended before deploying publicly).
- Protected by its own short-lived token (`x-admin-token` header, 2h expiry)
  issued by `POST /api/admin/login`, and by the same rate limiter as the auth
  endpoints to slow down brute-force attempts against the password.
- The admin can **permanently delete a store** (the account and all of its
  items, sales history, and settings) from the stores table. Everything else
  is read-only, and password hashes are never exposed.

---

## 📱 Telegram Mini App

The app can run inside Telegram as a **Mini App**, in addition to working as
a normal website. It automatically detects when it's opened inside Telegram
(via the [Telegram Web App SDK](https://core.telegram.org/bots/webapps),
loaded in `client/index.html`) and adapts:

- Expands to full height and follows Telegram's safe viewport size.
- Syncs the header/background chrome color with the app's light/dark theme.
- Shows Telegram's native **Back Button** instead of relying on browser
  navigation (e.g. from the Owner Portal back to the Worker Portal).

Outside Telegram none of this activates — the site behaves exactly as before.

**To register it as a Mini App:**

1. Deploy the frontend somewhere with **HTTPS** (required by Telegram).
2. Message [@BotFather](https://t.me/BotFather) → create a bot (or use an
   existing one) with `/newbot`.
3. Set the **Menu Button** as a Web App (this is what makes it open *inside*
   Telegram instead of a separate browser tab):
   `/mybots` → pick your bot → **Bot Settings → Menu Button → Configure menu
   button** → paste your deployed HTTPS URL and give it a short label (e.g.
   "Open Store").
4. That's it — the button now sits right next to the message box at all
   times. Tapping it opens the Mini App inline, with no extra "leave the
   chat and come back" step, and it works the very first time someone opens
   the chat (before they've even pressed Start).

> ⚠️ If instead you set a regular **URL button** (via `/setmenu` link
> buttons or an inline `url` button) it opens Telegram's in-app browser as a
> separate screen — that's the "leaves the chat" behavior. Only a **Web App**
> type button (Menu Button above, or `/newapp` for a direct `t.me/<bot>/<app>`
> link) opens the Mini App natively inline.

Login/session storage still uses the browser's `localStorage`/
`sessionStorage` inside Telegram's WebView, so accounts and sessions behave
the same as in a normal browser tab.

---

## ☁️ Deployment

The frontend and backend deploy independently.

### Database — set up Turso first (free, durable)

In production the app stores data in a hosted **Turso** (libSQL) database, so it
survives restarts and redeploys even on hosts with an ephemeral filesystem
(Render free tier, etc.). It's free and takes a minute:

```bash
# Install the CLI (macOS/Linux):
curl -sSfL https://get.tur.so/install.sh | bash

turso auth signup                      # or: turso auth login
turso db create scan-safe              # create the database
turso db show scan-safe --url          # -> TURSO_DATABASE_URL  (libsql://...)
turso db tokens create scan-safe       # -> TURSO_AUTH_TOKEN
```

Set those two values as backend environment variables (below). Locally you can
skip Turso entirely — leave them blank and the app uses a local SQLite file.

### Backend (Render / Railway / Fly.io / a VPS)

1. Set environment variables from the table above. **Always set a strong
   `JWT_SECRET`**, set `NODE_ENV=production`, and set **`TURSO_DATABASE_URL`** +
   **`TURSO_AUTH_TOKEN`** (the server refuses to boot in production without
   them, to prevent silent data loss).
2. Set `CLIENT_ORIGIN` to your front-end **origin** — scheme + host only, no
   path, no trailing slash (e.g. `https://app.yourstore.com`).
3. Build command: `npm install` (inside `server/`). Start command:
   `npm start` — i.e. `node src/index.js`.
4. Because data lives in Turso, **no persistent disk is required** and the
   backend can run on a free tier.

### Frontend (Vercel / Netlify / static host)

1. Build command: `npm run build` (inside `client/`). Output: `client/dist`.
2. Set `VITE_API_BASE_URL` to your deployed API origin.
3. Deploy the `dist/` folder as a static site (enable SPA fallback so client
   routes resolve to `index.html`).

### Custom domain

1. Point your domain's DNS (an `A`/`ALIAS` record, or `CNAME`) at your host.
2. Front-end on the apex/`www` (e.g. `app.yourstore.com`); API on a subdomain
   (e.g. `api.yourstore.com`).
3. Enable HTTPS (most hosts issue free TLS certificates automatically) —
   **required** for the camera scanner to work.
4. Set `CLIENT_ORIGIN` (backend) and `VITE_API_BASE_URL` (frontend) to the
   final HTTPS domains and redeploy.

---

## 🔒 Security notes

- Passwords and the 6-digit PIN are stored only as **bcrypt hashes**.
- All SQL uses **parameterized queries** with bound `?` placeholders (no string
  concatenation).
- **JWT** auth for sessions; a separate short-lived, account-bound **owner
  token** gates the owner portal.
- **Helmet** security headers, **CORS allow-listing**, and **rate limiting**
  (stricter on auth endpoints).
- Uploaded spreadsheets are validated, size-limited (5 MB), parsed in-memory,
  and never written to disk.
- Error responses never leak stack traces or internals in production.

### A note on `npm audit`

- **Backend:** clean of high-severity issues. Two *moderate* advisories remain
  via `exceljs`'s transitive `uuid` dependency; they concern UUID **v3/v5/v6**
  buffer handling, while ExcelJS only uses **v4**, so they are not exploitable
  here.
- **Frontend:** the reported advisories are **dev-server-only** (esbuild/Vite
  dev server) and do **not** affect the production build output. Vite is pinned
  to the stable 5.x line.

---

## 🧪 Testing locally without SMTP

Leave the `SMTP_*` variables blank. When a worker scans an item, the
notification email is printed to the backend console (look for `[email:dev]`),
so you can confirm the full flow without an email account.

---

## 📜 License

MIT — free to use, modify, and deploy for your store.
