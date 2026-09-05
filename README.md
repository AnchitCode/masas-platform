# 🏥 MASAS — Medicine Availability & Shortage Alert System

> A full-stack healthcare platform with AI-powered medicine search, prescription scanning, real-time availability alerts, and geospatial pharmacy discovery — built with TypeScript, React, Express, PostgreSQL + PostGIS + pgvector, and Ollama.

[![CI](https://github.com/AnchitCode/masas-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/AnchitCode/masas-platform/actions/workflows/ci.yml)

MASAS connects patients with nearby pharmacies that have the medicine they need — right now, within their area. Pharmacies manage live inventory, and the platform handles everything from intelligent search (including typos, Hindi queries, and prescription photos) to automated availability alerts when out-of-stock medicines are restocked.

---

## Engineering Highlights

| Category | Details |
|---|---|
| **AI-Powered Search** | Hybrid keyword + semantic search with Ollama embeddings, pgvector, Hinglish normalization, and typo/synonym resolution |
| **Prescription Scanner** | OCR (Tesseract.js) → LLM extraction (Phi-3.5) → catalog matching pipeline, fully local |
| **Real-Time Platform** | Socket.io push, persistent notifications, background availability alerts via BullMQ + Redis |
| **Geospatial** | PostGIS-powered proximity search with distance-aware ranking |
| **Auth & Security** | Google OAuth, email verification, JWT + refresh token rotation, SHA-256 hashing, RBAC, audit logging |
| **Testing** | 24 integration test files using Vitest + Supertest with isolated PostGIS + pgvector test database |
| **CI/CD** | GitHub Actions pipeline with PostGIS + pgvector service container, lint, test, and build stages |

---

## The Problem

Patients often visit 3–5 pharmacies before finding a medicine in stock. This is a daily healthcare accessibility issue — especially during emergencies, chronic disease treatment, or for rare medicines.

## The Solution

MASAS provides a centralized platform where:

- Patients **search for medicines** near their location and see real-time availability, pricing, and distance
- **AI understands intent** — typos ("Paractemol"), Hindi queries ("sir dard ki dawa"), synonyms ("acetaminophen"), and concept queries ("fever medicine") all return the right results
- **Prescription photos** can be uploaded to extract and find medicines automatically
- **Availability alerts** notify patients when an out-of-stock medicine is restocked nearby
- Pharmacies **manage inventory** with stock levels, pricing, and expiry tracking
- An **admin verification system** ensures only legitimate pharmacies appear in search results

---

## Core Features

### Intelligent Medicine Search

MASAS search goes far beyond keyword matching. The search pipeline combines multiple strategies to understand what the user actually wants:

```
User query → Hinglish normalizer → embedding → pgvector cosine search → confidence filter
                                                        ↓
                        Keyword ILIKE + semantic candidates + PostGIS proximity
                                                        ↓
                              Results ranked by relevance tier → distance
```

**What it handles:**

| Query Type | Example | How It Works |
|---|---|---|
| Exact match | "Aspirin" | Direct catalog lookup |
| Typo | "Paractemol" | Levenshtein edit distance (≤ 3 edits) resolves to "paracetamol" |
| Synonym | "acetaminophen" | Semantic similarity (≥ 0.65) resolves to "paracetamol" |
| Hinglish | "sir dard ki dawa" | Normalized to "headache medicine" → semantic search |
| Concept/NL | "fever medicine" | Category detection (fever → Analgesic) → filtered semantic results |
| Nonsense | "zzzzqqqq" | Confidence filter rejects — zero results, not random medicines |

**Key components:**
- **Hinglish normalizer** — deterministic phrase-first translation of Hindi-in-English pharmaceutical queries
- **Embedding pipeline** — each medicine in the catalog gets a 768-dimensional vector (via `nomic-embed-text`) stored in PostgreSQL using pgvector
- **Confidence filter** — three-signal gate (Hinglish normalization, pharmaceutical terms, high embedding score) prevents meaningless queries from returning random results
- **Hybrid SQL** — combines keyword ILIKE, semantic vector scores, and PostGIS distance in a single query, ranked by relevance tier then proximity

**Availability-aware behavior:**
- If the target medicine is **in stock** → show it, suppress semantic alternatives
- If the target medicine is **out of stock** → show it as unavailable, display same-category alternatives from nearby pharmacies
- Response metadata includes explicit `target: { name, isAvailable }` for clear frontend rendering

→ *Detailed implementation: [Phase 9 Documentation](Documentation/phase_9_documentation.md#91--intelligent-medicine-search)*

### Prescription Scanner

Upload a prescription photo → get matched medicines from the catalog.

```
Prescription image → Tesseract.js OCR → Phi-3.5 LLM extraction → Catalog matching
```

**Pipeline:**
1. **OCR** — Tesseract.js extracts printed text from the image (runs locally, no cloud APIs)
2. **LLM extraction** — Phi-3.5 (via Ollama) identifies medicine names from the OCR text, validated with Zod schemas
3. **Catalog matching** — each extracted name is matched against the database using exact → fuzzy → semantic tiers (max 3 matches per medicine)

**Safety by design:**
- The image buffer is **discarded immediately** after OCR — never stored on disk, in the database, or in logs
- LLM output is **always validated** with Zod before use — invalid responses are rejected
- The LLM is prompted to **never** provide medical advice, corrections, or substitutions
- Endpoint returns 200 with degraded results on any AI failure — never 500

→ *Detailed implementation: [Phase 9 Documentation](Documentation/phase_9_documentation.md#92--prescription-scanner)*

### Geospatial Pharmacy Discovery

All search results are geographically aware:
- PostGIS `ST_DWithin` for radius filtering and `ST_Distance` for distance calculation
- Configurable search radius (default 10 km, max 100 km)
- Only `VERIFIED` pharmacies with `isAvailable = true` and `quantity > 0` appear in results
- Results sorted by relevance score first, then proximity

### Real-Time Notifications & Availability Alerts

The platform is event-driven — inventory changes propagate instantly through multiple channels:

```
Pharmacy updates inventory → Event Bus
                               ├→ Socket.io (instant push to online users)
                               ├→ Notification (persisted in DB)
                               ├→ Email (queued via BullMQ)
                               └→ Availability detector (matches saved searches)
```

**For patients (CUSTOMER role):**
- Save a search (medicine + location + radius) → get notified when it's restocked nearby
- Notifications delivered via in-app bell, email, and real-time push
- Deduplication prevents alert spam while stock remains positive
- 30-minute background checker catches inventory that existed before the search was saved

**For pharmacies:**
- Low-stock threshold alerts when inventory crosses below a configurable level
- Verification/rejection notifications from admin actions
- Real-time inventory sync across browser sessions

→ *Detailed implementation: [Phase 8 Documentation](Documentation/phase_8_documentation.md)*

### Pharmacy Inventory Management

- Add medicines from a shared catalog (with autocomplete)
- Track stock quantity, pricing, expiry dates, and availability status
- Low-stock thresholds with automatic alerts
- Automatic catalog deduplication on inventory creation

### Authentication & Security

| Feature | Implementation |
|---|---|
| Google Sign-In | One-click OAuth via Google Identity Services |
| Email/password | Registration with mandatory email verification |
| Password reset | Token-based flow with email delivery, invalidates all sessions |
| Refresh tokens | Server-side stored (SHA-256 hashed), with rotation and replay detection |
| Session management | `tokenVersion` increment revokes all active sessions |
| Rate limiting | Route-specific limits (5/15min register, 3/15min email sends) |
| Audit logging | Every auth event tracked with IP, User-Agent, and metadata |
| RBAC | Three roles: `CUSTOMER`, `PHARMACY`, `ADMIN` with route-level enforcement |

### Admin Verification System

- Pharmacy verification workflow: `PENDING → VERIFIED / REJECTED`
- Admin dashboard with pharmacy listing and status management
- `ADMIN` accounts created only via secure database seeding — blocked from public registration
- Verification/rejection triggers notifications to pharmacy owners

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript (end-to-end) |
| **Frontend** | React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · Lucide Icons |
| **Backend** | Node.js · Express 4 · Zod validation |
| **Database** | PostgreSQL 16 · PostGIS · pgvector · Prisma 6 |
| **AI/ML** | Ollama (local) · nomic-embed-text (embeddings) · Phi-3.5 (LLM) · Tesseract.js (OCR) |
| **Real-Time** | Socket.io (WebSocket push) |
| **Job Queue** | BullMQ · Redis (ioredis) |
| **Auth** | JWT · Google OAuth (`google-auth-library`) · Nodemailer |
| **Testing** | Vitest · Supertest · 24 test files |
| **CI/CD** | GitHub Actions (PostGIS + pgvector + Redis service containers) |
| **Security** | Helmet · CORS · bcrypt · SHA-256 token hashing · express-rate-limit |
| **API Docs** | Swagger / OpenAPI (auto-generated) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MASAS Platform                                │
├────────────────────────────┬────────────────────────────────────────────┤
│      React Client          │            Express API Server              │
│                            │                                            │
│  Pages · Components        │    Middleware (auth, RBAC, validation)      │
│  Auth Context              │                                            │
│  Socket.io Client          │    Modules (8)                             │
│  Notification Bell         │    ├─ auth          (10 endpoints)         │
│  Search + Prescription UI  │    ├─ pharmacy      (4 endpoints)          │
│                            │    ├─ inventory     (3 endpoints)          │
│                            │    ├─ search        (1 endpoint)           │
│                            │    ├─ catalog       (1 endpoint)           │
│                            │    ├─ admin         (3 endpoints)          │
│                            │    ├─ notification  (5 endpoints)          │
│                            │    ├─ prescription  (1 endpoint)           │
│                            │    └─ saved-search  (4 endpoints)          │
│                            │                                            │
│                            │    AI Module                               │
│                            │    ├─ Provider abstraction (Ollama)        │
│                            │    ├─ Embedding pipeline                   │
│                            │    ├─ Semantic search (pgvector)           │
│                            │    ├─ Hinglish normalizer                  │
│                            │    ├─ OCR service (Tesseract.js)           │
│                            │    └─ Prescription extractor (Phi-3.5)     │
│                            │                                            │
│                            │    Event-Driven Infrastructure             │
│                            │    ├─ Event Bus (typed emitter)            │
│                            │    ├─ Socket.io (real-time push)           │
│                            │    ├─ Notification bridge                  │
│                            │    ├─ Availability detector                │
│                            │    └─ Low-stock detector                   │
├────────────────────────────┴────────────────────────────────────────────┤
│                                                                         │
│   PostgreSQL 16 + PostGIS + pgvector    Redis          Ollama           │
│   11 tables · 3 enums                  BullMQ          nomic-embed-text │
│   HNSW vector index                    3 queues        phi3.5           │
│   Geospatial indexes                   (email,         Tesseract.js     │
│                                         alerts,                         │
│                                         embeddings)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Authentication — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | — | Register account (email verification required) |
| `POST` | `/login` | — | Email + password login |
| `POST` | `/google` | — | Google OAuth authentication |
| `POST` | `/forgot-password` | — | Request password reset email |
| `POST` | `/reset-password` | — | Reset password using token |
| `GET` | `/verify-email` | — | Verify email address |
| `POST` | `/resend-verification` | — | Resend verification email |
| `POST` | `/refresh` | Cookie | Rotate access token |
| `GET` | `/me` | Bearer | Get authenticated user profile |
| `POST` | `/logout` | — | Revoke refresh token |

### Search — `/api/v1/search`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/inventory` | — | Hybrid keyword + semantic + geospatial medicine search |

### Prescription — `/api/v1/prescription`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/extract` | Bearer | Upload prescription image → OCR → LLM → catalog matching |

### Pharmacy — `/api/v1/pharmacy`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/profile` | Bearer | Create pharmacy profile |
| `GET` | `/profile` | Bearer | Get own pharmacy profile |
| `PUT` | `/profile` | Bearer | Update pharmacy profile |
| `GET` | `/:id` | — | Get public pharmacy profile |

### Inventory — `/api/v1/inventory`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/` | Bearer | Add medicine to inventory |
| `PUT` | `/:id` | Bearer | Update inventory item |
| `DELETE` | `/:id` | Bearer | Remove inventory item |

### Catalog — `/api/v1/catalog`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/search` | Bearer | Medicine name autocomplete |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Bearer | List notifications (paginated) |
| `GET` | `/unread-count` | Bearer | Get unread count for badge |
| `PATCH` | `/read-all` | Bearer | Mark all as read |
| `PATCH` | `/:id/read` | Bearer | Mark one as read |
| `DELETE` | `/:id` | Bearer | Delete a notification |

### Saved Searches — `/api/v1/saved-searches`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/` | Customer | Save a search for availability alerts |
| `GET` | `/` | Customer | List saved searches |
| `PATCH` | `/:id` | Customer | Toggle active/inactive, update radius |
| `DELETE` | `/:id` | Customer | Remove a saved search |

### Admin — `/api/v1/admin`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/pharmacies` | Admin | List all pharmacies with filters |
| `PATCH` | `/pharmacies/:id/verify` | Admin | Verify a pharmacy |
| `PATCH` | `/pharmacies/:id/reject` | Admin | Reject a pharmacy |

### System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | — | Server health check |
| `GET` | `/api/v1/ai/health` | — | AI subsystem health check |

---

## Local Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** 16+ with PostGIS and pgvector extensions
- **Redis** (for BullMQ job queues)
- **Google Cloud** OAuth 2.0 Client ID ([setup guide](https://console.cloud.google.com/apis/credentials))
- **SMTP credentials** (Gmail App Password or [Mailtrap](https://mailtrap.io/) for dev)
- **Ollama** (optional — required only for AI features)

### 1. Clone Repository

```bash
git clone https://github.com/AnchitCode/masas-platform.git
cd masas-platform
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file (see [`.env.example`](server/.env.example) for reference):

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/masas?sslmode=require

# Auth
JWT_ACCESS_SECRET=your-access-secret-min-32-chars-here
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-here

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=MASAS <noreply@masas.com>

# Frontend URL
CLIENT_URL=http://localhost:5173

# Redis (required for BullMQ)
REDIS_URL=redis://localhost:6379

# AI (optional — everything works without it)
AI_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
AI_EMBEDDING_MODEL=nomic-embed-text
AI_LLM_MODEL=phi3.5:3.8b-mini-instruct-q4_K_M
```

Run database setup:

```bash
npx prisma migrate deploy     # Apply migrations (creates tables, pgvector, PostGIS)
npx prisma db seed             # Create admin user
```

Start the backend:

```bash
npm run dev                    # Runs on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd client
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Start the frontend:

```bash
npm run dev                    # Runs on http://localhost:5173
```

### 4. AI Features (Optional)

AI features are disabled by default (`AI_ENABLED=false`). To enable:

```bash
# Install Ollama
brew install ollama            # macOS

# Pull required models
ollama pull nomic-embed-text                          # Embedding model (~274 MB)
ollama pull phi3.5:3.8b-mini-instruct-q4_K_M          # LLM for prescription extraction (~2.4 GB)

# Set AI_ENABLED=true in .env
# Restart the server
```

Backfill embeddings for existing medicines:

```bash
npx tsx scripts/run-backfill.ts
```

Verify AI health:

```
GET http://localhost:5000/api/v1/ai/health
```

### 5. Access Points

| URL | Description |
|---|---|
| `http://localhost:5173` | Frontend application |
| `http://localhost:5000/api/docs` | Swagger API documentation |
| `http://localhost:5000/api/v1/health` | Server health check |
| `http://localhost:5000/api/v1/ai/health` | AI health check |

---

## Testing

### Infrastructure

| Component | Details |
|---|---|
| **Runner** | Vitest (TypeScript-native) |
| **HTTP Testing** | Supertest (real HTTP requests against Express) |
| **Database** | Isolated PostgreSQL with PostGIS + pgvector |
| **Queue** | Redis for BullMQ integration tests |
| **Isolation** | Full table truncation between tests |
| **Coverage** | Vitest v8 coverage provider |

### Test Suite — 24 Test Files

| Test File | Covers |
|---|---|
| `auth.test.ts` | Registration, login, refresh, me, logout |
| `auth-enhanced.test.ts` | Email verification, forgot/reset password, token revocation, audit logging |
| `pharmacy.test.ts` | Profile CRUD, status transitions, public profiles |
| `inventory.test.ts` | Stock management, catalog auto-creation |
| `search.test.ts` | Hybrid search (keyword + semantic + geo), target resolution, match types |
| `admin.test.ts` | Pharmacy verification, rejection, admin access control |
| `catalog.test.ts` | Autocomplete search, case insensitivity |
| `customer.test.ts` | CUSTOMER role access control |
| `notification.test.ts` | CRUD, pagination, bridge integration |
| `savedSearch.test.ts` | CRUD, limits, duplicates, role enforcement |
| `eventBus.test.ts` | Emit, subscribe, typed events |
| `lowStock.test.ts` | Threshold crossing detection, recovery |
| `availabilityDetector.test.ts` | Detection, dedup, failure-safe lifecycle |
| `alertService.test.ts` | Background checker, cooldowns, batch processing |
| `emailWorker.test.ts` | Worker processes each job type |
| `queues.test.ts` | Redis connectivity, queue operations |
| `embedding.test.ts` | Text builder, hash computation, backfill service |
| `semanticSearch.test.ts` | pgvector search, confidence filter, pharmaceutical intent |
| `queryNormalizer.test.ts` | Hinglish normalization, phrase/word matching |
| `ocr.test.ts` | Tesseract.js wrapper, timeout handling |
| `prescriptionExtractor.test.ts` | LLM extraction, Zod validation |
| `catalogMatcher.test.ts` | Exact/fuzzy/semantic matching tiers |
| `dbSafety.test.ts` | Production database safety guard |
| `health.test.ts` | Health endpoint, 404 handling |

### Running Tests

```bash
cd server
npm run test                   # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage report
```

### Database Safety

A custom 8-check safety guard ([`dbSafety.ts`](server/src/utils/dbSafety.ts)) prevents test cleanup from running against production databases. Tests only execute destructive operations when all safety conditions are met (`NODE_ENV=test`, correct branch, correct host, explicit opt-in).

### CI/CD Pipeline

GitHub Actions runs automatically on push/PR to `main` and `develop`:

```
┌──────────────┐     ┌──────────────┐
│ Lint Backend │     │ Lint Frontend│
│  (ESLint)    │     │  (ESLint)    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│ Test Backend │     │Build Frontend│
│ (Vitest +    │     │ (TypeScript  │
│  PostGIS +   │     │  + Vite)     │
│  pgvector +  │     │              │
│  Redis)      │     │              │
└──────────────┘     └──────────────┘
```

The CI pipeline uses custom Docker containers with PostGIS + pgvector and a Redis service container for full integration testing.

---

## Documentation

Detailed technical documentation is in the [`Documentation/`](Documentation/) folder:

| Document | Covers |
|---|---|
| [Phase 9 Documentation](Documentation/phase_9_documentation.md) | AI search, embeddings, pgvector, Hinglish normalizer, semantic search, prescription scanner, OCR, LLM extraction, catalog matching, architecture, thresholds, testing |
| [Phase 8 Documentation](Documentation/phase_8_documentation.md) | Event bus, Socket.io, notifications, low-stock detection, BullMQ, customer role, saved searches, availability detection, background checker |
| [Phase 1–7 Documentation](Documentation/documentationTillPhase7.md) | Auth, pharmacy management, inventory, geospatial search, admin verification, CI/CD, database safety |

---

## Engineering Decisions

### Why local AI (Ollama) instead of cloud APIs?
Zero cost, full privacy (no patient data leaves the machine), works offline, and the provider abstraction makes it trivial to add OpenAI later with a single new class.

### Why Levenshtein for typos instead of just embeddings?
Embeddings capture *meaning*, not *spelling*. "Paractemol" (typo) might score higher for "crocin" (same use case) than for "paracetamol" (same drug). Edit distance catches spelling errors reliably without semantic confusion.

### Why a confidence filter on semantic search?
Cosine similarity always returns something — there's always a "closest" vector. Without the filter, searching "pizza" would return random medicines. The three-signal gate (pharmaceutical language, Hinglish normalization, high score) prevents this.

### Why server-side refresh tokens with SHA-256 hashing?
Enables individual token revocation on logout, mass invalidation on password reset (via `tokenVersion`), and replay detection. Even if the database is compromised, stored hashes can't be used as tokens.

### Why BullMQ instead of simple cron or fire-and-forget?
Job persistence across server restarts, automatic retries with exponential backoff, multi-instance safety via Redis locking, and observable failure tracking. Email sending, alert checking, and embedding generation all benefit from this reliability.

### Why an event bus?
Decouples inventory operations from their side effects. Adding a new reaction to inventory changes (SMS notifications, analytics) is just adding a new event listener — no modification to existing service code.

---

## Future Roadmap

- Docker Compose for one-command local development
- OpenAI provider option for cloud-based AI (provider abstraction already in place)
- Hindi Devanagari script support in search
- Handwritten prescription OCR
- Multi-city pharmacy scaling
- PWA support for mobile

---

## Author

Built by **Anchit Gupta**

---

If you found this project interesting, consider giving it a ⭐
