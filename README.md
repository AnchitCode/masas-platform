# 🏥 MASAS — Medicine Availability & Shortage Alert System

> **Production-oriented healthcare availability platform powered by PostgreSQL, PostGIS, Prisma, automated testing, and CI/CD.**

MASAS helps users discover nearby medicine availability in real time using geospatial search while enabling pharmacies to manage live inventory, stock visibility, and medicine availability efficiently.

Designed with a strong focus on backend engineering, database architecture, API reliability, testing infrastructure, and production-grade development practices.

---

## 🚀 Engineering Highlights

* 🗺️ Geospatial medicine search using PostgreSQL + PostGIS
* 🧩 Modular backend architecture (Routes → Controllers → Services → Prisma)
* 🔐 JWT authentication with refresh token workflow
* 🛡️ Role-based admin verification system
* 🧪 Backend integration testing using Vitest + Supertest
* 🧬 Dedicated isolated test database infrastructure
* ⚙️ GitHub Actions CI pipeline with PostGIS service container
* 📘 Swagger/OpenAPI API documentation
* 🔒 Database safety guards preventing destructive test operations on production

---

## 🚨 Real-World Problem

Patients often struggle to find medicines:

* Visit **3–5 pharmacies** before finding availability
* Face **out-of-stock or expired medicines**
* Critical during:

  * Emergency situations
  * Chronic disease treatment (BP, Diabetes)
  * Rare medicine requirements

👉 This is a real healthcare accessibility problem experienced daily by patients and families.

---

## 💡 Solution

MASAS provides a centralized platform that:

* 🔍 Shows real-time medicine availability
* 🏪 Connects users with nearby pharmacies
* 📦 Helps pharmacies manage inventory efficiently
* ⏳ Tracks stock levels and expiry information
* 📍 Enables location-aware medicine discovery using geospatial search

---

## 🧠 Core Platform Features

### 👤 Public Medicine Search

* Search medicines across nearby pharmacies
* Geospatial proximity search using PostGIS
* Distance-aware pharmacy discovery
* Availability-aware inventory visibility
* Excludes unverified pharmacies from public search

### 🏪 Pharmacy Management

* Pharmacy registration and onboarding
* Inventory CRUD management
* Stock quantity and expiry tracking
* Availability status management
* Pharmacy profile management

### 🛡️ Admin Verification System

* Role-based admin access control
* Pharmacy verification workflow
* Verification state transitions
* Secure protected admin routes

### 🔐 Authentication & Security

* JWT authentication
* Refresh token workflow
* Protected API routes
* Role-based authorization
* Input validation using Zod

### 🧪 Engineering Infrastructure

* Backend integration testing using Vitest + Supertest
* Dedicated isolated test database
* GitHub Actions CI pipeline
* Swagger/OpenAPI API documentation
* Database safety guards for destructive test operations

---

## 🛠️ Tech Stack

| Layer             | Technology                     |
| ----------------- | ------------------------------ |
| Frontend          | React + Vite + Tailwind CSS    |
| Backend           | Node.js + Express              |
| Database          | PostgreSQL + PostGIS           |
| ORM               | Prisma                         |
| Authentication    | JWT + Refresh Tokens           |
| Validation        | Zod                            |
| Testing           | Vitest + Supertest             |
| CI/CD             | GitHub Actions                 |
| API Documentation | Swagger / OpenAPI              |
| Deployment Ready  | Docker-compatible architecture |

---

## 🏗️ Backend Architecture

* **Users** → search medicines nearby
* **Pharmacies** → manage live inventory
* **Inventory** → connects pharmacies and medicines
* **Admin System** → verifies pharmacy legitimacy and controls public visibility

👉 Many-to-many relationships are handled through relational inventory mapping using PostgreSQL + Prisma.

---

## 🔍 Geospatial Search

Search medicine availability using geolocation-aware queries powered by PostGIS.

```http
GET /api/v1/search/inventory?query=paracetamol&lat=22.72&lng=75.86&radius=5000
```

Returns:

* Nearby pharmacies
* Distance-aware search results
* Availability status
* Inventory insights

---

## 📦 Project Structure

```bash
MASAS/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── context/
│
├── server/                 # Express backend
│   ├── prisma/             # Prisma schema & seed scripts
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── pharmacy/
│   │   │   ├── inventory/
│   │   │   ├── search/
│   │   │   └── admin/
│   │   ├── validations/
│   │   ├── lib/
│   │   └── __tests__/
│
├── .github/workflows/      # CI/CD pipelines
└── Documentation/
```

---

## ⚡ Local Development Setup

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

Create:

```bash
.env
```

Configure:

```env
DATABASE_URL=your_postgresql_url
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
CLIENT_URL=http://localhost:5173
```

Run Prisma migrations:

```bash
npx prisma migrate deploy
```

Start backend server:

```bash
npm run dev
```

---

### 3. Frontend Setup

```bash
cd client
npm install
npm run dev
```

---

## 🧪 Testing & Quality Assurance

MASAS includes a production-oriented backend testing infrastructure.

### Backend Integration Testing

* Vitest test runner
* Supertest API integration testing
* Real PostgreSQL/PostGIS test database
* Dedicated isolated Neon test branch
* Automated database cleanup between tests

### Tested Modules

* Authentication APIs
* Pharmacy APIs
* Inventory APIs
* Search APIs
* Admin workflows
* Catalog APIs

### CI/CD Pipeline

GitHub Actions automatically performs:

* Backend linting
* Backend integration tests
* Frontend linting
* Frontend build verification

The CI pipeline uses a PostGIS Docker service container to validate geospatial database behavior.

### Database Safety Infrastructure

Additional safety guards prevent destructive test operations from running against production databases.

Tests only execute cleanup operations when:

* `NODE_ENV=test`
* `DATABASE_BRANCH=masas-test`
* `ALLOW_TEST_DB_RESET=true`

---

## 📘 API Documentation

Swagger/OpenAPI documentation available at:

```bash
/api/docs
```

---

## 🎯 Engineering Highlights

MASAS was built to simulate production-oriented backend engineering practices rather than only frontend CRUD functionality.

### Key Technical Strengths

* Geospatial medicine discovery using PostGIS
* Modular scalable backend architecture
* Real PostgreSQL relational data modeling
* Prisma ORM integration
* JWT authentication + refresh token workflow
* Role-based authorization system
* Integration testing infrastructure
* CI/CD automation with GitHub Actions
* Swagger/OpenAPI API documentation
* Database safety guard implementation
* Environment isolation for test infrastructure

### Backend Engineering Focus

This project emphasizes:

* API reliability
* testability
* database correctness
* scalable module organization
* production-safe development workflows

rather than only UI implementation.

### Real-World Engineering Problems Solved

During development, the testing infrastructure exposed a dangerous production database truncation issue caused by Prisma environment auto-loading behavior.

The issue was investigated and resolved using:

* explicit environment isolation
* dedicated test database branching
* hard safety guards before destructive operations
* CI-safe environment validation

This significantly improved the robustness of the backend testing architecture.

---

## 🚀 Future Improvements

* Dockerized local development environment
* Testcontainers-based isolated integration testing
* Real-time inventory updates with WebSockets
* Medicine substitute recommendation engine
* AI-powered shortage prediction
* Advanced analytics dashboard
* Multi-city pharmacy scaling
* Redis caching layer
* Kubernetes-ready deployment architecture

---

## 👨‍💻 Author

Built by **Anchit Gupta**

Passionate about:

* Backend Engineering
* Scalable Systems
* Full Stack Development
* DevOps & Infrastructure
* Real-world Problem Solving

---

## ⭐ Support

If you found this project interesting, consider giving it a star ⭐
