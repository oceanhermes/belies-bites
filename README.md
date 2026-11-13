# belies.bites
Next.js + React + TypeScript, PostgreSQL + Prisma, Fonnte. Self-hosted; no Sites dependency.

## Local
1. Install Node 22.21+ and PostgreSQL 17.
2. `cp .env.example .env` and configure DATABASE_URL, APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters). Never commit .env.
3. `npm ci`
4. `npm run db:migrate`
5. `npm run db:seed` (creates admin and an **inactive** example PO; rerunning resets configured admin password).
6. `npm run dev`; in another terminal run `npm run worker` with the same environment loaded (`node --env-file=.env --import tsx scripts/worker.ts`).
7. Open http://localhost:3000/admin, set actual menu/prices, activate PO. Buyers need no account.

Prisma and Next load .env. Direct tsx commands for worker/seed should be launched with Node --env-file=.env, or exported environment variables. Example seed: `node --env-file=.env --import tsx scripts/seed.ts`.

## Deploy VPS
1. Copy .env.example to .env. Set long random POSTGRES_PASSWORD (hex), ADMIN_PASSWORD, email, and APP_URL=https://your-domain.example. DATABASE_URL is overridden by Compose.
2. `docker compose build`
3. `docker compose up -d db`
4. `docker compose run --rm web npm run db:migrate`
5. `docker compose run --rm web npm run db:seed`
6. `docker compose up -d web worker`
7. Reverse-proxy HTTPS to 127.0.0.1:3000 using Caddy/Nginx. HTTPS is required for production session cookies. Configure request body maximum 6 MB and rate limiting at reverse proxy. Set accurate APP_URL including protocol; API rejects mutation requests from other origins. Database must not be exposed publicly.

Back up PostgreSQL and the uploads volume. Run migrations before app/worker on updates. Do not delete volumes when updating. Start worker only after migrations. UI currently loads newest 300 orders; CSV exports those same records.

## Fonnte WhatsApp
Register/connect sender in Fonnte dashboard and check current plan limits. A free tier does not guarantee unlimited messages or permanent free service. Set FONNTE_TOKEN and WHATSAPP_ENABLED=true server-side, then restart web and worker. Never expose token as NEXT_PUBLIC_*.

Worker sends POST https://api.fonnte.com/send with Authorization token and target/message. Checkout records explicit WhatsApp consent. Events: order received, delivering, ready for pickup, cancelled (reason required). Order and notification are saved in a single database transaction. Unique event key and atomic claim prevent ordinary duplicate jobs. Rate limits retry with bounded backoff. Timeout/network uncertainty is UNKNOWN and requires admin review before manual retry: Fonnte may already have accepted it. Exactly-once delivery cannot be guaranteed without provider idempotency. SENT means **accepted by provider**, not delivered/read; delivery receipts webhook is not implemented. Test with your own number after configuring token; no real messages were sent during development.

If WhatsApp is disabled, orders still save and jobs become BLOCKED. Admin can retry after enabling. Tracking URL shown after checkout works without WhatsApp. Save it: it contains an unguessable private token and grants access to that order. Status notifications refer back to the initial tracking link. No buyer login.

## QRIS and payments
Put your real QRIS image in public/qris.png and set QRIS_IMAGE_URL=/qris.png. Restart web. Empty value hides QRIS option. Evidence is JPG/PNG max 5 MB, signature checked, private local volume; only authenticated admin can view it. Payment verification and refunds are manual. Product total excludes delivery fee, which admin coordinates separately. Never use the sample prices without reviewing them.

## API
- GET /api/preorders/active
- POST /api/orders (multipart: `data` JSON and optional `proof` file)
- POST /api/orders/track (`token`)
- POST /api/admin/login, /logout
- GET /api/admin/dashboard
- POST /api/admin/preorders; PATCH /api/admin/preorders/:id
- POST /api/admin/menus; PATCH /api/admin/menus/:id
- PATCH /api/admin/orders/:id/status
- GET /api/admin/orders/:id/proof
- POST /api/admin/notifications/:id/retry (`confirmed:true`)

Same-origin session-cookie authentication, bcrypt password hashing, SHA-256 hashed session/tracking tokens. Admin authorization enforced on server. Public order creation recalculates prices and checks PO in a serializable transaction. Request keys prevent duplicate checkout submissions; on uncertain HTTP response, check initial WhatsApp confirmation before placing another order. No automatic refunds or payment gateway.

## Checks
`npm test`; `npm run build`. Integration test instructions: configure an isolated PostgreSQL database, run migrations/seed, start app and worker with WhatsApp disabled; submit cash and QRIS orders, close PO and check checkout rejection, verify anonymous admin requests return 401, advance statuses, inspect Notification rows, then enable Fonnte only with your test number.
