# Auditra — Security Audit Log Dashboard

Auditra is a full-stack application built for security teams to ingest, explore, and investigate large volumes of audit log data. It supports bulk uploads of up to 50,000 records, real-time filtering, global search, and a clean dashboard to get quick visibility into system events by severity, status, actor, region, and more.

---

## What does it do?

- **Bulk ingest** structured JSON log files (up to 50,000 records per session)
- **Filter and search** across every log field in real time
- **Sort** by any column — timestamp, severity, actor, action, resource type, etc.
- **Visualise** critical vs high vs low severity breakdowns at a glance via stat cards
- **Delete** all ingested data cleanly when you want a fresh start
- Designed to run against **MongoDB Atlas** out of the box

---

## Tech stack

**Frontend — React 19 + Vite + TypeScript**
Vite gives instant HMR and fast production builds. React 19 with the new compiler was chosen to stay on the modern baseline. TypeScript enforces type safety across every API boundary.

**State — Zustand**
Much simpler than Redux for this use case — the filter and pagination state fits naturally into a single flat Zustand store.

**Server state — TanStack Query (React Query)**
Handles server state caching, background refetching, and `placeholderData` to avoid layout shifts during pagination.

**HTTP client — Axios**
Built-in interceptors make it easy to normalise error shapes from the API in a single place.

**Backend — Node.js + Express + TypeScript**
Express is mature, well-understood, and has the fastest cold-start time for a Node API. TypeScript on the server gives us type safety end-to-end.

**Database — MongoDB + Mongoose**
Log data is naturally document-shaped and schema-flexible. MongoDB's `insertMany` with `ordered: false` is ideal for bulk ingestion — it continues inserting even if individual documents fail validation.

**Validation — Joi**
Declarative schema validation at the HTTP layer before anything touches the database.

**Logging — Winston + Morgan**
Structured JSON logs in production, colourised dev logs. Morgan pipes HTTP access logs through Winston so everything goes to one sink.

**Security — Helmet + express-mongo-sanitize + express-rate-limit**
Helmet sets safe HTTP headers. Mongo sanitize strips `$` operators from request bodies to prevent NoSQL injection. Rate limiting is split — uploads have a tight limit (5/min), reads are generous (200/min).

---

## Project structure

```
SecAudit/
├── client/               React + Vite frontend
│   ├── src/
│   │   ├── api/          Axios client + all API call functions
│   │   ├── components/   UI components (layout, logs, filters, upload, data)
│   │   ├── hooks/        Data-fetching hooks built on TanStack Query
│   │   ├── pages/        Page-level components (just DashboardPage for now)
│   │   ├── store/        Zustand store for filter/sort/pagination state
│   │   ├── types/        Shared TypeScript interfaces
│   │   └── utils/        Formatters and helpers
│   ├── public/           Static assets (favicon)
│   ├── .env.example      Environment variable template
│   └── vercel.json       Vercel deployment config
│
├── server/               Express + TypeScript API
│   ├── src/
│   │   ├── config/       Database connection + app-wide constants
│   │   ├── controllers/  HTTP request handlers (thin layer, just delegates)
│   │   ├── middleware/   Error handler, rate limiter, request ID injector
│   │   ├── models/       Mongoose schema + index definitions
│   │   ├── routes/       Express route registration
│   │   ├── services/     Business logic — queries, bulk insert, stats
│   │   ├── types/        TypeScript interfaces for log data
│   │   ├── utils/        AppError class, query builder, Winston logger, async wrapper
│   │   └── validators/   Joi schemas for request body + query param validation
│   ├── scripts/          Mock data generator
│   ├── .env.example      Environment variable template
│   └── railway.json      Railway deployment config
│
└── .gitignore
```

---

## Local setup

### Prerequisites

- Node.js 18 or higher
- A MongoDB Atlas cluster (or a local MongoDB instance)

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd SecAudit
```

### 2. Backend setup

```bash
cd server
npm install
```

Copy the example env file and fill in your MongoDB connection string:

```bash
cp .env.example .env
```

Open `.env` and set your `MONGO_URI`. If your password contains special characters like `@` or `+`, URL-encode them — `@` becomes `%40`, `+` becomes `%2B`.

```bash
# Start the dev server (tsx watch for hot reload)
npm run dev
```

The API starts on `http://localhost:5000`.

### 3. Generate test data (optional)

If you want 15,000 mock log records to test with:

```bash
node scripts/generateMockData.js
```

This creates `scripts/mock_logs.json`. You can then drag and drop it into the upload modal in the UI.

### 4. Frontend setup

Open a second terminal:

```bash
cd client
npm install
cp .env.example .env
```

The default `VITE_API_URL=http://localhost:5000/api` already points to your local server. Then:

```bash
npm run dev
```

The UI starts on `http://localhost:5173`.

---

## Technical decisions

### Why `ordered: false` in `insertMany`?

MongoDB's `insertMany` by default is ordered — if one document fails, the entire batch stops. Setting `ordered: false` tells MongoDB to continue inserting valid documents even when some fail validation. For audit log ingestion, a few malformed records should never block thousands of good ones. This is the most important single decision for bulk upload reliability.

### Why chunked uploads on the frontend?

Sending 50,000 records in a single HTTP request is risky — Nginx proxies, browser timeouts, and Vercel's request limits all create failure points. The client splits large payloads into 5,000-record chunks sent sequentially. Each chunk completes independently, so partial progress is never lost and the UI can show real percentage progress rather than fake loading states.

### Why a separate `buildLogQuery` utility?

Keeping query construction logic out of the controller and service makes it easy to test in isolation and reason about. The query builder translates HTTP query string parameters into a validated MongoDB filter, handles comma-separated multi-value inputs (e.g. `severity=HIGH,CRITICAL`), and clamps pagination to safe bounds — all in one deterministic function.

### Why compound indexes?

A text index alone on `actor`, `action`, and `resource` handles the global search. But most dashboard queries combine fields — investigators typically filter by `severity` then sort by `timestamp`, or filter by `actor` then sort by `timestamp`. Compound indexes on `{ severity, timestamp }`, `{ actor, timestamp }`, and `{ status, timestamp }` match these access patterns directly, letting MongoDB satisfy those queries from the index without scanning the full collection.

### Why `estimatedDocumentCount` for the stats total?

`countDocuments({})` scans the collection to count every document — O(n). `estimatedDocumentCount()` reads the collection metadata stored by MongoDB — O(1). For a dashboard stat card that just needs a rough total, this makes a meaningful difference at scale.

### Why Zustand over Redux?

The application state is a flat object — filters, sort direction, current page, modal visibility. There's no complex action graph, no async state that needs middleware, and no need for a selector layer. Zustand handles this with about 30 lines of code, compared to several hundred for a comparable Redux setup.

### Why TanStack Query instead of `useEffect`?

TanStack Query gives automatic caching, stale-while-revalidate behaviour, and `placeholderData` to keep the previous page's data visible while a new page loads (no layout shift). Implementing this correctly with `useEffect` and `useState` would take several hundred lines and would still be brittle. It also handles query key invalidation on upload and delete — the dashboard refreshes automatically without any manual wiring.

### Why a separate `AppError` class?

Express's default error handling is all-or-nothing. The `AppError` class lets us distinguish between operational errors (bad input, not found, rate limited) and unexpected programmer errors. The global error handler responds differently to each — operational errors get a clean JSON response, unexpected errors get logged with full stack traces and return a generic 500 without leaking internals.

### Why `requestIdMiddleware`?

When something goes wrong in production, the single most valuable thing you can have is a request ID that links the client-side error report to the server-side log entry. Every request gets a UUID attached at the middleware layer. It flows through Winston logs and is exposed in the `X-Request-ID` response header so the client can surface it to the user or include it in error reports.

---

## Deployment

The frontend is deployed on **Vercel**, the backend on **Railway**, and the database runs on **MongoDB Atlas**. See `client/vercel.json` and `server/railway.json` for the deployment configuration. Set your environment variables in the respective platform dashboards before deploying — never commit `.env` files.

---

## API reference

**GET /api/health**
Health check, returns uptime.

**GET /api/logs**
Paginated log query with full filter support.

**GET /api/logs/stats**
Severity and status breakdowns plus total count.

**GET /api/logs/filter-options**
Distinct values for all filter dropdowns.

**POST /api/logs/bulk-upload**
Ingest a JSON array of log records.

**DELETE /api/logs**
Delete all log records.

---

Query parameters for `GET /api/logs`:

**page** (number) — Page number, default 1.

**limit** (number) — Records per page, max 200, default 25.

**sortBy** (string) — Field to sort by, default `timestamp`.

**sortOrder** (`asc` or `desc`) — Sort direction, default `desc`.

**search** (string) — Full-text search across actor, action, resource.

**severity** (string) — Single or comma-separated: `HIGH,CRITICAL`.

**status** (string) — `Resolved`, `Unresolved`, or `In Progress`.

**actor** (string) — Partial match, case-insensitive.

**role** (string) — Exact match.

**action** (string) — Exact match.

**resourceType** (string) — Exact match.

**region** (string) — Exact match.

**startDate** (ISO date) — Filter logs from this date.

**endDate** (ISO date) — Filter logs up to this date.
