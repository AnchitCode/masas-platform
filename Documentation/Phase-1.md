# Phase 1: Foundation + Authentication

**Status:** ✅ Completed  
**Duration:** Day 1  
**Date:** May 11, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [What Was Built](#2-what-was-built)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Project Structure](#4-project-structure)
5. [Configuration Layer](#5-configuration-layer)
6. [Utility Layer](#6-utility-layer)
7. [Middleware Layer](#7-middleware-layer)
8. [Database Schema](#8-database-schema)
9. [Auth Module](#9-auth-module)
10. [API Endpoints](#10-api-endpoints)
11. [Authentication Flow](#11-authentication-flow)
12. [Test Results](#12-test-results)
13. [How to Run](#13-how-to-run)
14. [Known Decisions & Trade-offs](#14-known-decisions--trade-offs)
15. [What's Next — Phase 2](#15-whats-next--phase-2)

---

## 1. Overview

Phase 1 establishes the **backend foundation** for the MASAS platform. It sets up the Express server, database schema, shared middleware, and a fully functional JWT authentication system. By the end of this phase, the server can:

- Start and respond to health checks
- Register new pharmacy/admin users
- Authenticate users via email + password
- Issue and refresh JWT access tokens
- Protect routes via role-based authorization
- Validate all incoming requests with Zod schemas
- Handle errors consistently with structured JSON responses
- Log all requests and errors

No frontend work was done in Phase 1 — this phase is backend-only.

---

## 2. What Was Built

| Step | Description | Status |
|------|-------------|--------|
| Monorepo Init | `server/` directory, `package.json`, `.gitignore`, `.env.example` | ✅ |
| Express Scaffold | `app.js` with Helmet, CORS, Morgan, rate limiting, cookie parser | ✅ |
| Config Layer | Environment validation (`env.js`) and CORS config (`cors.js`) | ✅ |
| Utility Layer | Logger, ApiResponse, ApiError, JWT helpers | ✅ |
| Middleware | Auth (JWT), Authorize (roles), Validate (Zod), Error Handler | ✅ |
| Prisma Schema | 4 models + enums + indexes, migrated to NeonDB | ✅ |
| Auth Module | Register, Login, Refresh, Me, Logout — full CRUD | ✅ |
| Testing | 10 endpoint tests passing — all auth flows verified | ✅ |

---

## 3. Tech Stack & Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.x | Web framework |
| `cors` | ^2.x | Cross-Origin Resource Sharing |
| `helmet` | ^8.x | Security HTTP headers |
| `morgan` | ^1.x | HTTP request logging |
| `bcryptjs` | ^3.x | Password hashing (12 salt rounds) |
| `jsonwebtoken` | ^9.x | JWT token generation & verification |
| `zod` | ^3.x | Request validation schemas |
| `dotenv` | ^16.x | Environment variable loading |
| `express-rate-limit` | ^7.x | API rate limiting |
| `cookie-parser` | ^1.x | Parse cookies (refresh tokens) |
| `@prisma/client` | ^6.x | Database ORM client |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | ^6.x | Schema management & migrations |
| `nodemon` | ^3.x | Auto-restart server on file changes |

---

## 4. Project Structure

```
server/
├── prisma/
│   ├── schema.prisma              # Database schema (4 models, 2 enums)
│   └── migrations/
│       └── 20260511190917_init/   # Initial migration
│           └── migration.sql
├── src/
│   ├── index.js                   # Entry point — starts the server
│   ├── app.js                     # Express app — middleware + route mounting
│   ├── config/
│   │   ├── env.js                 # Env variable validation (fail-fast)
│   │   └── cors.js                # CORS origin configuration
│   ├── lib/
│   │   └── prisma.js              # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.js                # JWT verification (Bearer token)
│   │   ├── authorize.js           # Role-based access control
│   │   ├── validate.js            # Zod schema validation
│   │   └── errorHandler.js        # Global error handler
│   ├── modules/
│   │   └── auth/
│   │       ├── auth.routes.js     # Route definitions
│   │       ├── auth.controller.js # HTTP request handlers
│   │       ├── auth.service.js    # Business logic
│   │       └── auth.validation.js # Zod schemas
│   ├── utils/
│   │   ├── logger.js              # Centralized logger (leveled)
│   │   ├── apiResponse.js         # Standardized response format
│   │   ├── apiError.js            # Custom error class
│   │   └── jwt.js                 # Token generation & verification
│   └── validations/
│       └── common.validation.js   # Shared schemas (uuid, pagination, coords)
├── .env                           # Local environment variables (git-ignored)
├── .env.example                   # Template for environment variables
└── package.json                   # Dependencies and scripts
```

**Total files:** 20 source files + config files

---

## 5. Configuration Layer

### `src/config/env.js` — Environment Validation

This file loads `.env` via `dotenv` and validates that all required variables are present **at startup**. If any are missing, the server crashes immediately with a clear error message (fail-fast pattern).

**Required variables:**
- `DATABASE_URL` — PostgreSQL connection string (NeonDB)
- `JWT_ACCESS_SECRET` — Secret for signing access tokens (min 32 chars)
- `JWT_REFRESH_SECRET` — Secret for signing refresh tokens (min 32 chars)

**Optional variables (with defaults):**
| Variable | Default |
|----------|---------|
| `NODE_ENV` | `development` |
| `PORT` | `5001` |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `CLIENT_URL` | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX` | `100` |

**Exported helpers:** `env.isDev` and `env.isProd` for conditional logic.

### `src/config/cors.js` — CORS Configuration

- **Development:** Allows `localhost:5173` and `localhost:3000`
- **Production:** Restricts to the single `CLIENT_URL` value
- Enables `credentials: true` for httpOnly cookie support (refresh tokens)

---

## 6. Utility Layer

### `src/utils/logger.js` — Centralized Logger

A lightweight logger that wraps `console` with log levels:

| Level | When Used | Visible In |
|-------|-----------|------------|
| `error` | Errors, exceptions | All environments |
| `warn` | Warnings, deprecations | All environments |
| `info` | Server startup, key events | All environments |
| `debug` | Detailed debugging | Development only |

**Output format:** `[ISO_TIMESTAMP] [LEVEL] message {optional meta JSON}`

Designed to be swapped with Winston or Pino later without changing call sites.

### `src/utils/apiResponse.js` — Standardized Responses

All API responses follow this shape:

```json
// Success
{ "success": true, "message": "...", "data": { ... } }

// Error
{ "success": false, "message": "...", "errors": [ ... ] }
```

Two static methods:
- `ApiResponse.success(res, statusCode, message, data)`
- `ApiResponse.error(res, statusCode, message, errors)`

### `src/utils/apiError.js` — Custom Error Class

Extends native `Error` with HTTP status codes. Provides static factory methods:

| Method | Status Code | Use Case |
|--------|-------------|----------|
| `ApiError.badRequest()` | 400 | Validation failures |
| `ApiError.unauthorized()` | 401 | Missing/invalid credentials |
| `ApiError.forbidden()` | 403 | Insufficient permissions |
| `ApiError.notFound()` | 404 | Resource not found |
| `ApiError.conflict()` | 409 | Duplicate entries |
| `ApiError.internal()` | 500 | Unexpected errors |

Errors thrown with `isOperational = true` are expected errors. Unexpected errors are caught separately.

### `src/utils/jwt.js` — Token Helpers

| Function | Token Type | Expiry | Payload |
|----------|-----------|--------|---------|
| `generateAccessToken()` | Access | 15 min | `{ userId, role }` |
| `generateRefreshToken()` | Refresh | 7 days | `{ userId }` |
| `verifyAccessToken()` | Access | — | Returns decoded payload |
| `verifyRefreshToken()` | Refresh | — | Returns decoded payload |

---

## 7. Middleware Layer

### Request Flow

```
Request → Helmet → CORS → Morgan → JSON Parser → Cookie Parser → Rate Limiter
       → Route Matching → [validate] → [auth] → [authorize] → Controller
       → Response OR → Error Handler → Error Response
```

### `src/middleware/auth.js` — JWT Authentication

- Extracts Bearer token from `Authorization` header
- Verifies the token using `JWT_ACCESS_SECRET`
- Attaches `req.user = { userId, role }` for downstream use
- Returns 401 if token is missing, invalid, or expired

### `src/middleware/authorize.js` — Role-Based Access

- Factory function: `authorize('PHARMACY')` or `authorize('ADMIN')`
- Must be used **after** `auth` middleware (requires `req.user`)
- Returns 403 if the user's role is not in the allowed list

**Usage pattern:**
```javascript
router.get('/admin-only', auth, authorize('ADMIN'), controller.method);
router.post('/pharmacy-only', auth, authorize('PHARMACY'), controller.method);
```

### `src/middleware/validate.js` — Zod Validation

- Factory function: `validate(zodSchema, 'body' | 'query' | 'params')`
- Runs `schema.safeParse()` on the specified request source
- On failure: returns 400 with field-level error messages
- On success: replaces `req[source]` with parsed/transformed data

**Usage pattern:**
```javascript
router.post('/register', validate(registerSchema, 'body'), controller.register);
```

### `src/middleware/errorHandler.js` — Global Error Handler

Catches all errors and returns structured JSON responses. Handles:

| Error Type | Response |
|------------|----------|
| `ApiError` (operational) | Uses error's statusCode and message |
| Prisma `P2002` (unique constraint) | 409 Conflict |
| Prisma `P2025` (not found) | 404 Not Found |
| `ZodError` | 400 with field-level details |
| `JsonWebTokenError` | 401 Invalid token |
| `TokenExpiredError` | 401 Token expired |
| Unexpected errors | 500 (no details leaked in production) |

All errors are logged via `logger.error()` with stack trace, path, and method.

---

## 8. Database Schema

### Database: NeonDB (Serverless PostgreSQL)
### ORM: Prisma 6.19.3
### Extension: PostGIS (configured in schema, for future geospatial queries)

### Models

#### `User` → `users` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | Primary Key, auto-generated |
| `email` | String | Unique |
| `password_hash` | String | Bcrypt hash (12 rounds) |
| `role` | Enum | `PHARMACY` (default) or `ADMIN` |
| `created_at` | DateTime | Auto-set on creation |
| `updated_at` | DateTime | Auto-updated |

#### `Pharmacy` → `pharmacies` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK → users.id, Unique, Cascade delete |
| `name` | String | — |
| `license_number` | String | Unique |
| `address` | String | — |
| `phone` | String | — |
| `latitude` | Float | — |
| `longitude` | Float | — |
| `status` | Enum | `PENDING` (default) / `VERIFIED` / `REJECTED` |
| `created_at` | DateTime | Auto-set |
| `updated_at` | DateTime | Auto-updated |

#### `MedicineCatalog` → `medicine_catalog` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `name` | String | Indexed (stored lowercase) |
| `generic_name` | String? | Indexed |
| `manufacturer` | String? | — |
| `category` | String? | — |
| `dosage_form` | String? | — |
| `created_at` | DateTime | Auto-set |
| `updated_at` | DateTime | Auto-updated |

#### `PharmacyInventory` → `pharmacy_inventory` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `pharmacy_id` | UUID | FK → pharmacies.id, Indexed |
| `medicine_id` | UUID | FK → medicine_catalog.id, Indexed |
| `price` | Float | — |
| `quantity` | Int | Default: 0 |
| `expiry_date` | DateTime? | — |
| `is_available` | Boolean | Default: true, Indexed |
| `created_at` | DateTime | Auto-set |
| `updated_at` | DateTime | Auto-updated |

**Unique constraint:** `(pharmacy_id, medicine_id)` — a pharmacy can only have one entry per medicine.

### Entity Relationships

```
User 1 ←→ 0..1 Pharmacy (one user owns at most one pharmacy)
Pharmacy 1 ←→ 0..* PharmacyInventory (pharmacy stocks many medicines)
MedicineCatalog 1 ←→ 0..* PharmacyInventory (medicine referenced by many pharmacies)
```

---

## 9. Auth Module

The auth module follows the **Routes → Controller → Service → Prisma** pattern.

### `auth.validation.js` — Zod Schemas

**`registerSchema`:**
| Field | Rules |
|-------|-------|
| `email` | Required, valid email format, lowercased, trimmed |
| `password` | Required, min 8 chars, max 128 chars |
| `role` | Optional, enum `PHARMACY` or `ADMIN`, defaults to `PHARMACY` |

**`loginSchema`:**
| Field | Rules |
|-------|-------|
| `email` | Required, valid email format, lowercased, trimmed |
| `password` | Required, min 1 char |

### `auth.service.js` — Business Logic

| Method | Logic |
|--------|-------|
| `register()` | Check duplicate email → hash password (bcrypt 12) → create user → generate tokens |
| `login()` | Find user by email → compare hash → generate tokens |
| `refresh()` | Verify refresh token → check user exists → generate new token pair |
| `getMe()` | Fetch user by ID with pharmacy relation |

### `auth.controller.js` — HTTP Handlers

Each method:
1. Calls the corresponding service method
2. Sets/clears the `refreshToken` httpOnly cookie
3. Returns a standardized response via `ApiResponse`
4. Forwards errors to global error handler via `next(error)`

**Cookie configuration:**
| Property | Development | Production |
|----------|-------------|------------|
| `httpOnly` | `true` | `true` |
| `secure` | `false` | `true` |
| `sameSite` | `lax` | `none` |
| `maxAge` | 7 days | 7 days |
| `path` | `/` | `/` |

### `auth.routes.js` — Route Definitions

```
POST   /api/v1/auth/register  → validate(registerSchema) → controller.register
POST   /api/v1/auth/login     → validate(loginSchema)    → controller.login
POST   /api/v1/auth/refresh   →                            controller.refresh
GET    /api/v1/auth/me        → auth                     → controller.getMe
POST   /api/v1/auth/logout    →                            controller.logout
```

---

## 10. API Endpoints

### Base URL: `http://localhost:5001/api/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Server health check |
| POST | `/auth/register` | No | Create new user account |
| POST | `/auth/login` | No | Authenticate and get tokens |
| POST | `/auth/refresh` | Cookie | Refresh access token |
| GET | `/auth/me` | Bearer | Get current user profile |
| POST | `/auth/logout` | No | Clear refresh token cookie |

### Response Format

**Success (example — register):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "9dd2cd0a-789c-4e06-acd0-b061c7d01497",
      "email": "pharmacy@test.com",
      "role": "PHARMACY",
      "createdAt": "2026-05-11T19:09:47.545Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error (example — validation):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

**Error (example — unauthorized):**
```json
{
  "success": false,
  "message": "Access token is required"
}
```

---

## 11. Authentication Flow

### Registration Flow
```
Client                          Server                         Database
  |                               |                               |
  |  POST /auth/register          |                               |
  |  {email, password, role}      |                               |
  |------------------------------>|                               |
  |                               |  Validate with Zod            |
  |                               |  Hash password (bcrypt 12)    |
  |                               |                               |
  |                               |  Check duplicate email        |
  |                               |------------------------------>|
  |                               |  No duplicate found           |
  |                               |<------------------------------|
  |                               |                               |
  |                               |  INSERT user                  |
  |                               |------------------------------>|
  |                               |  User created                 |
  |                               |<------------------------------|
  |                               |                               |
  |                               |  Generate accessToken (15m)   |
  |                               |  Generate refreshToken (7d)   |
  |                               |  Set refreshToken cookie      |
  |                               |                               |
  |  201 { user, accessToken }    |                               |
  |  + Set-Cookie: refreshToken   |                               |
  |<------------------------------|                               |
```

### Token Refresh Flow
```
Client                          Server                         Database
  |                               |                               |
  |  POST /auth/refresh           |                               |
  |  Cookie: refreshToken=...     |                               |
  |------------------------------>|                               |
  |                               |  Verify refresh token         |
  |                               |  Extract userId               |
  |                               |                               |
  |                               |  Check user still exists      |
  |                               |------------------------------>|
  |                               |  User found                   |
  |                               |<------------------------------|
  |                               |                               |
  |                               |  Generate new accessToken     |
  |                               |  Generate new refreshToken    |
  |                               |  Rotate cookie                |
  |                               |                               |
  |  200 { accessToken }          |                               |
  |  + Set-Cookie: refreshToken   |                               |
  |<------------------------------|                               |
```

### Token Strategy Summary

| Token | Storage | Lifetime | Payload | Sent Via |
|-------|---------|----------|---------|----------|
| Access Token | Client memory (React state) | 15 minutes | `{ userId, role }` | `Authorization: Bearer <token>` |
| Refresh Token | httpOnly cookie | 7 days | `{ userId }` | Cookie (automatic) |

---

## 12. Test Results

All tests performed on **May 11, 2026** against `http://localhost:5001`.

| # | Test | Method | Endpoint | Expected | Actual | Status |
|---|------|--------|----------|----------|--------|--------|
| 1 | Health check | GET | `/api/v1/health` | 200 | 200 | ✅ |
| 2 | Register (valid) | POST | `/api/v1/auth/register` | 201 + user + token | 201 | ✅ |
| 3 | Login (valid) | POST | `/api/v1/auth/login` | 200 + user + token | 200 | ✅ |
| 4 | Get profile (with token) | GET | `/api/v1/auth/me` | 200 + user data | 200 | ✅ |
| 5 | Get profile (no token) | GET | `/api/v1/auth/me` | 401 | 401 | ✅ |
| 6 | Refresh token | POST | `/api/v1/auth/refresh` | 200 + new token | 200 | ✅ |
| 7 | Duplicate register | POST | `/api/v1/auth/register` | 409 conflict | 409 | ✅ |
| 8 | Wrong password | POST | `/api/v1/auth/login` | 401 | 401 | ✅ |
| 9 | Validation error | POST | `/api/v1/auth/register` | 400 + field errors | 400 | ✅ |
| 10 | Unknown route | GET | `/api/v1/nothing` | 404 | 404 | ✅ |

**Result: 10/10 tests passed ✅**

---

## 13. How to Run

### Prerequisites
- Node.js v18+
- NeonDB account with a PostgreSQL database
- PostGIS extension enabled on the database

### Setup

```bash
# 1. Navigate to server directory
cd server

# 2. Install dependencies
npm install

# 3. Create .env from template
cp .env.example .env

# 4. Edit .env — set your NeonDB connection string and JWT secrets
#    DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
#    JWT_ACCESS_SECRET=your-secret-min-32-chars
#    JWT_REFRESH_SECRET=your-secret-min-32-chars

# 5. Run database migration
npx prisma migrate dev --name init

# 6. Generate Prisma client
npx prisma generate

# 7. Start development server
npm run dev
```

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `nodemon src/index.js` | Start with auto-reload |
| `npm start` | `node src/index.js` | Start for production |
| `npm run prisma:generate` | `prisma generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | `prisma migrate dev` | Run pending migrations |
| `npm run prisma:studio` | `prisma studio` | Open database GUI |

### Quick Test

```bash
# Health check
curl http://localhost:5001/api/v1/health

# Register
curl -X POST http://localhost:5001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 14. Known Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **Prisma 6 over Prisma 7** | Prisma 7 introduced breaking changes (`prisma.config.ts`, removed `url` from schema). v6 is stable and beginner-friendly. |
| **Port 5001 over 5000** | Port 5000 conflicts with macOS AirPlay Receiver on newer macOS versions. |
| **No TypeScript** | Reduces complexity at MVP stage. JSDoc comments provide type hints where needed. |
| **bcryptjs over bcrypt** | Pure JS implementation — no native build dependencies, easier to deploy. |
| **httpOnly cookie for refresh token** | More secure than localStorage — immune to XSS attacks. |
| **No customer auth at MVP** | Public search doesn't require login. Deferred to V1.1 to reduce scope. |
| **Zod `.issues` not `.errors`** | `safeParse().error` is a `ZodError` object. The array is `.issues`, not `.errors`. Fixed during development. |
| **`next(error)` not `throw`** | Express middleware requires errors to go through `next()` to reach the global error handler. `throw` only works inside async functions with proper wrappers. |

---

## 15. What's Next — Phase 2

**Phase 2: Pharmacy Onboarding (Days 3–5)**

- Pharmacy profile CRUD APIs with Zod validation
- PostGIS geography column for pharmacy location
- Set up React + Vite + Tailwind + Shadcn UI (frontend init)
- Frontend: Login, Register pages
- AuthContext and ProtectedRoute
- Pharmacy dashboard shell and profile management page

The auth system built in Phase 1 provides the foundation for all authenticated features going forward. Phase 2 will be the first module to use `auth` and `authorize('PHARMACY')` middleware for route protection.
