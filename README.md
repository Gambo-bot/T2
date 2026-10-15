# NPP Constituency Register

Web app + backend (Node.js, Express, SQLite): shared database, server-side login, staff approval by administrators, staff see only their own records, audit log, CSV import/export.

> **GitHub cannot run this app by itself.** GitHub stores the code and runs automatic checks; GitHub Pages only hosts static pages. The app needs a server and a database file, so you deploy it from GitHub to a host that runs Node (steps below).

## 1. Put the code on GitHub
1. Create a **private** repository on github.com (the register handles personal data; keep the code private too).
2. Upload everything in this folder (drag and drop in the browser, or `git init && git add . && git commit -m "Initial" && git remote add origin <url> && git push -u origin main`).
3. GitHub Actions (`.github/workflows/ci.yml`) now runs the automated tests on every push. A green tick means the app passes its 32 checks.

## 2. Deploy to Render (recommended)
1. Sign in at render.com with your GitHub account.
2. **New → Blueprint**, pick your repository. Render reads `render.yaml` and sets up the web service and a 1 GB persistent disk for the database.
3. When prompted, type a strong **ADMIN_PASSWORD** (at least 10 characters). It is only used once, to create the first administrator `admin`.
4. Click deploy. When it is live, open the URL Render gives you (it is HTTPS already). You can attach your own domain in Render's settings.
5. Sign in as `admin` with that password. You are forced to choose a new one at once.
6. In Render, **delete the ADMIN_PASSWORD variable** (it is no longer needed), then create named accounts for your team under *Users & approvals*.

A persistent disk needs a paid Render plan. Without a disk the database is wiped on every restart, so do not use a free plan for real data. Railway, Fly.io or any Ubuntu server also work: use the `Dockerfile`, mount a volume at `/app/data` (or set `DB_PATH`), and set `COOKIE_SECURE=true`, `TRUST_PROXY=1` and `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## 3. Run it on your own computer
```bash
npm install
npm start          # http://localhost:3000
```
Needs Node 20+. On first start with no `ADMIN_*` variables set, a random password for `admin` is printed **once** in the terminal. To choose your own: `ADMIN_USERNAME=admin ADMIN_PASSWORD='YourLongPassword' npm start`.
Leave the terminal open while you use the site.

## Backups (important)
All data is in one file: `register.db` (on Render: `/var/data/register.db`). Download or copy a backup every day and keep copies outside the server. Render disk snapshots help but are not a substitute.

## Who can do what
| | Staff | Administrator |
|---|---|---|
| Sign up | Request access; must be approved | Approves / rejects requests |
| Records | Add; view, edit, export **only their own** | View, edit, delete, import, export **all** |
| Users | none | Create, disable/enable, reset passwords |
| Audit log | none | Full log |

## Security notes
bcrypt password hashing, forced first-login password change, 30-minute idle timeout, account lockout and rate limits, HttpOnly SameSite cookies, CSRF header check, strict Content-Security-Policy, parameterised SQL, CSV formula-injection protection, staff isolation enforced in the database queries. Never commit `.env`, database files, or passwords to GitHub.

## Data protection (Ghana)
This holds voters' personal data. Under the Data Protection Act, 2012 (Act 843) the organisation running it should register with the Data Protection Commission, collect only what it needs, explain how data is used, keep it secure and delete it when no longer needed. Take legal advice on consent and retention.

## Files
`server.js` API · `public/` web app · `tests/smoke.js` automated tests (`npm test`) · `render.yaml` Render blueprint · `Dockerfile` · `create-admin.js` add another admin (`node create-admin.js <username> "<Full name>"`).
