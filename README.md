# 🏥 MASAS — Medicine Availability & Shortage Alert System

> **Production-grade healthcare SaaS platform built with TypeScript, React, Express, PostgreSQL + PostGIS, Prisma, Google OAuth, and a fully automated CI/CD pipeline.**

MASAS helps patients discover nearby medicine availability in real time using geospatial search, while enabling pharmacies to manage live inventory, stock visibility, and medicine availability — all within a secure, admin-verified ecosystem.

[![CI](https://github.com/AnchitCode/masas-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/AnchitCode/masas-platform/actions/workflows/ci.yml)

---

## 🚀 Engineering Highlights

| Category | Details |
|---|---|
| 🗺️ **Geospatial Search** | PostGIS-powered medicine discovery with distance-aware pharmacy results |
| 🔐 **SaaS-Level Auth** | Google OAuth, email verification, forgot/reset password, JWT + refresh token rotation |
| 🛡️ **Security** | SHA-256 token hashing, session invalidation, audit logging, rate limiting, RBAC |
| 🧩 **Architecture** | Modular TypeScript backend (Routes → Validation → Controllers → Services → Prisma) |
| 🧪 **Testing** | 129 integration tests across 9 test files using Vitest + Supertest |
| ⚙️ **CI/CD** | GitHub Actions pipeline with PostGIS service container, lint, test, and build stages |
| 📘 **API Docs** | Auto-generated Swagger/OpenAPI documentation |
| 🔒 **DB Safety** | 8-check safety guard preventing destructive test operations on production databases |

---

## 🚨 The Problem

Patients often struggle to find medicines — visiting **3–5 pharmacies** before finding availability. This is a real healthcare accessibility problem experienced daily, especially during:

- Emergency situations
- Chronic disease treatment (BP, diabetes)
- Rare medicine requirements

## 💡 The Solution

MASAS provides a centralized platform that:

- 🔍 Shows **real-time medicine availability** across nearby pharmacies
- 📍 Enables **location-aware medicine discovery** using geospatial search
- 🏪 Helps pharmacies **manage inventory** efficiently
- ⏳ Tracks **stock levels and expiry** information
- 🛡️ Ensures pharmacy legitimacy through **admin verification**

---

## 🧠 Core Features

### 🔍 Public Medicine Search
- Geospatial proximity search powered by PostgreSQL + PostGIS
- Distance-aware pharmacy results sorted by nearest first
- Availability-aware inventory visibility
- Only verified pharmacies appear in public search results

### 🔐 SaaS-Level Authentication
- **Google Sign-In** — One-click OAuth authentication via Google Identity Services
- **Email/Password** registration with mandatory email verification
- **Forgot Password** — Token-based password reset flow with email delivery
- **Remember Me** — 7-day (default) or 30-day session duration
- **Refresh Token Rotation** — Stored server-side with SHA-256 hashing
- **Session Invalidation** — Password reset revokes all active sessions via `tokenVersion`
- **Authentication Audit Logging** — Every auth event tracked with IP + User-Agent

### 🏪 Pharmacy Management
- Pharmacy registration and profile onboarding
- Inventory CRUD with stock quantity, pricing, and expiry tracking
- Availability status management (in-stock / out-of-stock)
- Auto-resubmit to pending on profile update after rejection

### 🛡️ Admin Verification System
- Role-based admin access control (ADMIN users created only via secure seeding)
- Pharmacy verification workflow (PENDING → VERIFIED / REJECTED)
- Admin dashboard with pharmacy listing, filtering, and status management
- Protected admin-only API routes

### 📦 Medicine Catalog
- Global medicine catalog shared across all pharmacies
- Autocomplete search by name and generic name
- Automatic catalog deduplication on inventory creation

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript (end-to-end) |
| **Frontend** | React 19 · Vite · Vanilla CSS · React Router 7 · Lucide Icons |
| **Backend** | Node.js · Express 4 · Zod validation |
| **Database** | PostgreSQL 16 · PostGIS · NeonDB (serverless) |
| **ORM** | Prisma 6 |
| **Authentication** | JWT · Refresh Tokens · Google OAuth (`google-auth-library`) · Nodemailer |
| **Testing** | Vitest · Supertest · 129 integration tests |
| **CI/CD** | GitHub Actions (4-stage pipeline with PostGIS service container) |
| **API Docs** | Swagger / OpenAPI (auto-generated from JSDoc annotations) |
| **Security** | Helmet · CORS · bcrypt · SHA-256 token hashing · express-rate-limit |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MASAS Platform                           │
├──────────────────────────┬──────────────────────────────────────┤
│       React Client       │          Express API Server          │
│                          │                                      │
│  ┌──────────────────┐    │    ┌──────────────────────────────┐  │
│  │ Pages            │    │    │ Middleware                    │  │
│  │ ├─ Home          │    │    │ ├─ auth (JWT verify)         │  │
│  │ ├─ Search        │    │    │ ├─ authorize (RBAC)          │  │
│  │ ├─ Login         │◄───┼───►│ ├─ validate (Zod)           │  │
│  │ ├─ Register      │    │    │ ├─ errorHandler              │  │
│  │ ├─ Dashboard     │    │    │ └─ pharmacy (status guard)   │  │
│  │ ├─ Admin Panel   │    │    ├──────────────────────────────┤  │
│  │ └─ Auth Pages    │    │    │ Modules (6)                  │  │
│  │   ├─ Verify Email│    │    │ ├─ auth     (10 endpoints)   │  │
│  │   ├─ Forgot Pass │    │    │ ├─ pharmacy (4 endpoints)    │  │
│  │   └─ Reset Pass  │    │    │ ├─ inventory(3 endpoints)    │  │
│  ├──────────────────┤    │    │ ├─ search   (1 endpoint)     │  │
│  │ Services         │    │    │ ├─ catalog  (1 endpoint)     │  │
│  │ ├─ authService   │    │    │ └─ admin    (3 endpoints)    │  │
│  │ └─ api (Axios)   │    │    ├──────────────────────────────┤  │
│  ├──────────────────┤    │    │ Utils                        │  │
│  │ Context          │    │    │ ├─ jwt      (access/refresh) │  │
│  │ └─ AuthContext   │    │    │ ├─ email    (SMTP transport) │  │
│  ├──────────────────┤    │    │ ├─ tokenUtils (SHA-256)      │  │
│  │ Hooks            │    │    │ ├─ authAudit (event logging) │  │
│  │ └─ useGoogleAuth │    │    │ └─ dbSafety (8-check guard)  │  │
│  └──────────────────┘    │    └──────────────┬───────────────┘  │
│                          │                   │                  │
│                          │    ┌──────────────▼───────────────┐  │
│                          │    │   PostgreSQL + PostGIS        │  │
│                          │    │   (NeonDB Serverless)         │  │
│                          │    │                               │  │
│                          │    │   9 tables · 2 enums          │  │
│                          │    │   Geospatial extensions       │  │
│                          │    └───────────────────────────────┘  │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## 📦 Project Structure

```
MASAS/
├── client/                          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/              # ProtectedRoute, etc.
│   │   │   ├── dashboard/           # Dashboard widgets
│   │   │   ├── inventory/           # Inventory management UI
│   │   │   ├── layout/              # Navbar, layouts
│   │   │   ├── search/              # Search results, cards
│   │   │   └── ui/                  # Button, Input, AlertBanner, forms
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # Auth state + Google OAuth
│   │   ├── hooks/
│   │   │   └── useGoogleAuth.ts     # Google Identity Services hook
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Landing page
│   │   │   ├── Search.tsx           # Medicine search
│   │   │   ├── Login.tsx            # Sign in (Google + email)
│   │   │   ├── Register.tsx         # Sign up (Google + email)
│   │   │   ├── AccountCreated.tsx   # Post-registration confirmation
│   │   │   ├── ForgotPassword.tsx   # Request password reset
│   │   │   ├── ResetPassword.tsx    # Token-based password reset
│   │   │   ├── VerifyEmail.tsx      # Email verification handler
│   │   │   ├── TermsOfService.tsx   # Legal page
│   │   │   ├── PrivacyPolicy.tsx    # Legal page
│   │   │   ├── PublicPharmacy.tsx    # Public pharmacy profile
│   │   │   ├── dashboard/           # Pharmacy dashboard, profile, inventory
│   │   │   └── admin/               # Admin dashboard, pharmacy management
│   │   ├── services/
│   │   │   ├── api.ts               # Axios instance with interceptors
│   │   │   └── authService.ts       # Auth API methods
│   │   └── utils/
│   │       └── constants.ts         # Routes, env vars, enums
│   └── index.html                   # Entry point + Google GIS script
│
├── server/                          # Express + TypeScript backend
│   ├── prisma/
│   │   ├── schema.prisma            # 9 models, 2 enums, PostGIS
│   │   ├── migrations/              # SQL migrations (version-controlled)
│   │   └── seed.ts                  # Admin user seeding
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts               # Env validation (fail-fast)
│   │   │   ├── cors.ts              # CORS configuration
│   │   │   └── swagger.ts           # OpenAPI spec generation
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT verification
│   │   │   ├── authorize.ts         # Role-based access control
│   │   │   ├── validate.ts          # Zod schema validation
│   │   │   ├── pharmacy.ts          # Pharmacy status guard
│   │   │   └── errorHandler.ts      # Global error handler
│   │   ├── modules/
│   │   │   ├── auth/                # register, login, google, refresh, logout,
│   │   │   │                        # forgot-password, reset-password, verify-email,
│   │   │   │                        # resend-verification, me
│   │   │   ├── pharmacy/            # profile CRUD, public profile
│   │   │   ├── inventory/           # stock management
│   │   │   ├── search/              # PostGIS geospatial search
│   │   │   ├── catalog/             # medicine autocomplete
│   │   │   └── admin/               # pharmacy verification workflows
│   │   ├── utils/
│   │   │   ├── jwt.ts               # Token generation/verification (jti uniqueness)
│   │   │   ├── email.ts             # Provider-agnostic SMTP (Nodemailer)
│   │   │   ├── tokenUtils.ts        # Secure token generation + SHA-256 hashing
│   │   │   ├── authAudit.ts         # Fire-and-forget audit logging
│   │   │   ├── dbSafety.ts          # 8-check production database guard
│   │   │   ├── apiError.ts          # Custom error class
│   │   │   ├── apiResponse.ts       # Standardized response format
│   │   │   └── logger.ts            # Structured logging
│   │   └── __tests__/               # 9 test files, 129 integration tests
│   │       ├── setup.ts             # Test DB lifecycle + factory helpers
│   │       ├── auth.test.ts         # Core auth tests
│   │       ├── auth-enhanced.test.ts# SaaS auth tests (28 cases)
│   │       ├── pharmacy.test.ts     # Pharmacy module tests
│   │       ├── inventory.test.ts    # Inventory module tests
│   │       ├── search.test.ts       # Geospatial search tests
│   │       ├── catalog.test.ts      # Catalog search tests
│   │       ├── admin.test.ts        # Admin workflow tests
│   │       ├── dbSafety.test.ts     # Safety guard tests
│   │       └── health.test.ts       # Health endpoint tests
│   └── .env.example                 # Required environment variables
│
├── .github/workflows/
│   └── ci.yml                       # 4-stage CI pipeline
│
└── Documentation/                   # Design docs and references
```

---

## 🔌 API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | — | Register pharmacy account (email verification required) |
| `POST` | `/login` | — | Email + password login (returns JWT + sets refresh cookie) |
| `POST` | `/google` | — | Google OAuth authentication |
| `POST` | `/forgot-password` | — | Request password reset email |
| `POST` | `/reset-password` | — | Reset password using token |
| `GET` | `/verify-email` | — | Verify email address using token |
| `POST` | `/resend-verification` | — | Resend verification email |
| `POST` | `/refresh` | Cookie | Rotate access token using refresh token |
| `GET` | `/me` | Bearer | Get authenticated user profile |
| `POST` | `/logout` | — | Revoke refresh token + clear cookie |

### Pharmacy (`/api/v1/pharmacy`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/profile` | Bearer | Create pharmacy profile |
| `GET` | `/profile` | Bearer | Get own pharmacy profile |
| `PUT` | `/profile` | Bearer | Update pharmacy profile |
| `GET` | `/:id` | — | Get public pharmacy profile |

### Inventory (`/api/v1/inventory`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/` | Bearer | Add medicine to inventory |
| `PUT` | `/:id` | Bearer | Update inventory item |
| `DELETE` | `/:id` | Bearer | Remove inventory item |

### Search (`/api/v1/search`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/inventory` | — | Geospatial medicine search with distance |

### Catalog (`/api/v1/catalog`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/search` | Bearer | Medicine name autocomplete |

### Admin (`/api/v1/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/pharmacies` | Admin | List all pharmacies with filters |
| `PATCH` | `/pharmacies/:id/verify` | Admin | Verify a pharmacy |
| `PATCH` | `/pharmacies/:id/reject` | Admin | Reject a pharmacy |

---

## 🔍 Geospatial Search

Search medicine availability using geolocation-aware queries powered by PostGIS:

```http
GET /api/v1/search/inventory?query=paracetamol&lat=22.72&lng=75.86&radius=5000
```

Returns distance-sorted results:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "pharmacyName": "HealthPlus Pharmacy",
        "distance": "1.2 km",
        "medicineName": "Paracetamol 500mg",
        "price": 25.50,
        "quantity": 150,
        "isAvailable": true
      }
    ]
  }
}
```

---

## 🔐 Authentication Flow

```
┌─────────────────── Registration Flow ───────────────────┐
│                                                          │
│  Register ──► Email Sent ──► Verify Email ──► Login     │
│     │                                           │        │
│     │  (Google)                                  ▼        │
│     └──────────────────────────────────────► Dashboard   │
│                                                 │        │
│                              Pharmacy Status Check       │
│                              ├─ No pharmacy → Profile    │
│                              ├─ PENDING → Waiting        │
│                              ├─ VERIFIED → Full Access   │
│                              └─ REJECTED → Update        │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─────────────────── Password Reset Flow ─────────────────┐
│                                                          │
│  Forgot Password ──► Email Sent ──► Reset Password      │
│                                         │                │
│                              All sessions invalidated    │
│                              (tokenVersion incremented)  │
│                                         │                │
│                                      Login Again         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Security Measures

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt with salt rounds |
| Token storage | Only SHA-256 hashes stored — raw tokens never persisted |
| Token cleanup | Verification/reset tokens deleted after single use |
| Session invalidation | Password reset increments `tokenVersion`, revokes all refresh tokens |
| Token rotation | Each refresh generates a new JWT; old token revoked |
| JWT uniqueness | Random `jti` (UUID) ensures every JWT is distinct |
| No user enumeration | Forgot-password and resend-verification always return 200 |
| Admin protection | ADMIN role blocked from public registration and Google sign-in |
| Rate limiting | Route-specific limits (5/15min register, 3/15min email, 5/15min reset) |
| Audit trail | All auth events logged with IP address, User-Agent, and metadata |

---

## ⚡ Local Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** 16+ with PostGIS extension (or [NeonDB](https://neon.tech/) free tier)
- **Google Cloud** OAuth 2.0 Client ID ([setup guide](https://console.cloud.google.com/apis/credentials))
- **SMTP credentials** (Gmail App Password or [Mailtrap](https://mailtrap.io/) for dev)

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

Create a `.env` file (see [`.env.example`](server/.env.example) for all required variables):

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
```

Run database setup:

```bash
npx prisma migrate deploy     # Apply migrations
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

### 4. Access the Application

| URL | Description |
|---|---|
| `http://localhost:5173` | Frontend application |
| `http://localhost:5000/api/docs` | Swagger API documentation |
| `http://localhost:5000/api/v1/health` | Health check endpoint |

---

## 🧪 Testing & Quality Assurance

### Test Infrastructure

| Component | Details |
|---|---|
| **Runner** | Vitest (fast, TypeScript-native) |
| **HTTP Testing** | Supertest (real HTTP requests against Express app) |
| **Database** | Dedicated isolated PostgreSQL/PostGIS test database |
| **Isolation** | Full table truncation between tests |
| **Coverage** | Vitest v8 coverage provider |

### Test Suite — 129 Tests Across 9 Files

| Test File | Tests | What It Covers |
|---|---|---|
| `auth.test.ts` | 17 | Registration, login, refresh, me, logout |
| `auth-enhanced.test.ts` | 28 | Email verification, forgot/reset password, token revocation, audit logging |
| `pharmacy.test.ts` | 16 | Profile CRUD, status transitions, public profiles |
| `inventory.test.ts` | 14 | Stock management, medicine catalog auto-creation |
| `search.test.ts` | 10 | Geospatial search, distance sorting, availability filtering |
| `admin.test.ts` | 13 | Pharmacy verification, rejection, admin access control |
| `catalog.test.ts` | 6 | Autocomplete search, case insensitivity |
| `dbSafety.test.ts` | 10 | Production database safety guard validation |
| `health.test.ts` | 3 | Health endpoint, 404 handling |

### Running Tests

```bash
cd server
npm run test                   # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage report
```

### CI/CD Pipeline

GitHub Actions automatically runs on every push/PR to `main` and `develop`:

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
│  PostGIS)    │     │  + Vite)     │
└──────────────┘     └──────────────┘
```

The CI pipeline uses a **PostGIS Docker service container** to validate geospatial database behavior in an isolated environment.

### Database Safety Infrastructure

A custom 8-check safety guard ([`dbSafety.ts`](server/src/utils/dbSafety.ts)) prevents destructive test operations from running against production databases. Tests only execute cleanup when:

- `NODE_ENV=test`
- `DATABASE_BRANCH=masas-test`
- `ALLOW_TEST_DB_RESET=true`
- Database hostname matches the safe test host
- Database hostname does NOT match the production host

---

## 📊 Database Schema

```
┌───────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    users      │       │   pharmacies     │       │ medicine_catalog │
│───────────────│       │──────────────────│       │──────────────────│
│ id            │◄──┐   │ id               │       │ id               │
│ email         │   │   │ user_id (FK)     │───┐   │ name             │
│ password_hash │   │   │ name             │   │   │ generic_name     │
│ name          │   │   │ license_number   │   │   │ manufacturer     │
│ google_id     │   │   │ address          │   │   │ category         │
│ is_email_     │   │   │ phone            │   │   │ dosage_form      │
│   verified    │   │   │ latitude         │   │   └────────┬─────────┘
│ token_version │   │   │ longitude        │   │            │
│ role          │   │   │ status           │   │            │
│ avatar_url    │   │   └──────────┬───────┘   │            │
└───┬───────────┘   │              │           │            │
    │               │              │           │            │
    │  ┌────────────┘   ┌──────────▼───────────▼────────────▼─┐
    │  │                │     pharmacy_inventory               │
    │  │                │─────────────────────────────────────│
    │  │                │ id                                   │
    │  │                │ pharmacy_id (FK)                     │
    │  │                │ medicine_id (FK)                     │
    │  │                │ price · quantity · expiry_date       │
    │  │                │ is_available                         │
    │  │                └─────────────────────────────────────┘
    │  │
    │  │  ┌────────────────────┐  ┌────────────────────────┐
    │  ├──│ refresh_tokens     │  │ password_reset_tokens  │
    │  │  │ token_hash (SHA256)│  │ token_hash (SHA256)    │
    │  │  │ expires_at         │  │ expires_at · used_at   │
    │  │  │ revoked_at         │  └────────────────────────┘
    │  │  └────────────────────┘
    │  │
    │  │  ┌────────────────────────┐  ┌────────────────────┐
    │  ├──│ email_verification_    │  │ auth_audit_logs    │
    │  │  │   tokens               │  │ action · ip_address│
    │  │  │ token_hash (SHA256)    │  │ user_agent         │
    │  │  │ expires_at             │  │ metadata (JSON)    │
    │  │  └────────────────────────┘  └────────────────────┘
    │  │
    └──┘
```

**9 tables** · **2 enums** (`UserRole`, `PharmacyStatus`) · PostGIS geospatial extensions

---

## 📘 API Documentation

Interactive Swagger/OpenAPI documentation is available in development mode:

```
http://localhost:5000/api/docs
```

---

## 🎯 Engineering Decisions

### Why TypeScript End-to-End?

The entire codebase (client + server + tests + config) uses TypeScript for compile-time safety, better refactoring confidence, and consistent developer experience across the stack.

### Why Stored Refresh Tokens?

Unlike stateless JWTs, refresh tokens are stored server-side (as SHA-256 hashes) to enable:
- Individual token revocation on logout
- Mass invalidation on password reset (via `tokenVersion`)
- Token rotation with replay detection
- Audit trail of active sessions

### Why SHA-256 Token Hashing?

Verification and reset tokens are hashed before storage — even if the database is compromised, attackers cannot use the stored hashes to verify emails or reset passwords.

### Why Route-Specific Rate Limiting?

Different endpoints have different abuse profiles. Registration and email-sending endpoints have strict limits (3-5 per 15 minutes) while search remains open for public use.

### Why a Database Safety Guard?

During development, Prisma's `.env` auto-loading caused test cleanup to run against production — potentially truncating real data. The 8-check safety guard ensures this can never happen.

---

## 🚀 Future Improvements

- 🐳 Dockerized local development environment
- 🧪 Testcontainers-based isolated integration testing
- 📡 Real-time inventory updates with WebSockets
- 💊 Medicine substitute recommendation engine
- 🤖 AI-powered shortage prediction
- 📊 Advanced analytics dashboard
- 🌐 Multi-city pharmacy scaling
- ⚡ Redis caching layer
- ☸️ Kubernetes-ready deployment architecture
- 📱 Progressive Web App (PWA) support

---

## 👨‍💻 Author

Built by **Anchit Gupta**

Passionate about backend engineering, scalable systems, full-stack development, DevOps & infrastructure, and real-world problem solving.

---

## ⭐ Support

If you found this project interesting, consider giving it a star ⭐
