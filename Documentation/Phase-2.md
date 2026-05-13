# MASAS — Phase 2 Documentation

# Pharmacy Onboarding + Frontend Integration

---

# 1. Phase Overview

Phase 2 focused on transforming MASAS from a backend-only API system into a fully authenticated full-stack healthcare SaaS application.

The major goal of this phase was to establish:

* Pharmacy onboarding flow
* Frontend application structure
* Authentication infrastructure
* Protected dashboard system
* Pharmacy profile management
* Frontend ↔ Backend ↔ Database integration

At the end of Phase 2, MASAS became a real working application where pharmacy owners can:

* Register
* Login
* Access protected dashboard
* Create pharmacy profile
* Edit pharmacy profile
* Persist data in PostgreSQL database

---

# 2. Objectives of Phase 2

The core objectives were:

1. Build pharmacy management backend module
2. Initialize scalable frontend architecture
3. Implement JWT authentication flow
4. Create protected dashboard system
5. Connect frontend with backend APIs
6. Store pharmacy data in database
7. Prepare architecture for inventory management (Phase 3)

---

# 3. Backend Architecture

Backend follows Modular Monolith Architecture.

Architecture Flow:

Routes → Controller → Service → Prisma ORM → PostgreSQL

Each layer has a clear responsibility.

---

# 4. Pharmacy Backend Module

Folder:

src/modules/pharmacy/

Files created:

* pharmacy.validation.js
* pharmacy.service.js
* pharmacy.controller.js
* pharmacy.routes.js

---

# 5. Pharmacy Validation Layer

File:
src/modules/pharmacy/pharmacy.validation.js

Purpose:
Validate incoming request data using Zod.

Implemented schemas:

* Create Pharmacy Schema
* Update Pharmacy Schema

Validation included:

* pharmacy name
* license number
* address
* phone number
* coordinates
* required field checks

Why this matters:

* Prevents invalid data from reaching business logic
* Standardizes API input validation
* Improves backend reliability

---

# 6. Pharmacy Service Layer

File:
src/modules/pharmacy/pharmacy.service.js

Purpose:
Contains all pharmacy business logic.

Responsibilities:

* Create pharmacy profile
* Fetch pharmacy profile
* Update pharmacy profile
* Prevent duplicate pharmacy creation
* Communicate with Prisma ORM

Important logic implemented:

* One pharmacy per owner validation
* Database interaction abstraction
* Ownership verification

Why service layer matters:
Controllers remain thin and business logic stays reusable and maintainable.

---

# 7. Pharmacy Controller Layer

File:
src/modules/pharmacy/pharmacy.controller.js

Purpose:
Handle HTTP request/response cycle.

Responsibilities:

* Receive request
* Call service methods
* Send API response
* Handle async errors

Controllers do NOT contain:

* database queries
* business rules
* complex validation

Why:
Keeps architecture clean and scalable.

---

# 8. Pharmacy Routes Layer

File:
src/modules/pharmacy/pharmacy.routes.js

Purpose:
Define all pharmacy-related API endpoints.

Implemented routes:

POST   /api/v1/pharmacy
GET    /api/v1/pharmacy/me
PATCH  /api/v1/pharmacy/me

Security:

* JWT protected routes
* Role-based authorization

Routes connected in:
src/app.js

---

# 9. Authentication Flow

Authentication system uses:

* JWT Access Tokens
* bcrypt password hashing
* Auth middleware
* Protected routes

Flow:

Register →
Login →
Receive JWT →
Store token →
Attach token to requests →
Access protected resources

Frontend automatically sends token using Axios interceptors.

---

# 10. Frontend Initialization

Frontend initialized inside:

client/

Tech Stack:

* React
* Vite
* Tailwind CSS
* Shadcn UI
* React Router
* Axios

Goals of frontend setup:

* Fast development
* Scalable component structure
* Reusable UI system
* Modern SPA architecture

---

# 11. Frontend Folder Architecture

Main frontend structure:

src/
│
├── components/
├── context/
├── pages/
├── services/
├── layouts/
├── routes/

Architecture principle:
Separation of concerns.

---

# 12. API Layer

File:
src/services/api.js

Purpose:
Central Axios configuration.

Implemented:

* baseURL configuration
* request interceptors
* Authorization header injection
* centralized API handling

Why this matters:
Avoids repeated API configuration everywhere.

---

# 13. Authentication Service

File:
src/services/authService.js

Purpose:
Encapsulate authentication API calls.

Implemented methods:

* register()
* login()
* logout()
* getMe()

Why:
Keeps API logic separate from UI components.

---

# 14. Auth Context

File:
src/context/AuthContext.jsx

Purpose:
Global authentication state management.

Managed:

* authenticated user
* loading state
* login/logout methods
* auth persistence

Why Context API:
Current app scale does not require Redux.

Benefits:

* Simpler architecture
* Less boilerplate
* Easier maintainability

---

# 15. Protected Routes

File:
src/components/common/ProtectedRoute.jsx

Purpose:
Prevent unauthorized access to dashboard routes.

Behavior:

* If token missing → redirect to login
* If unauthorized role → block access
* If authenticated → allow access

Importance:
Frontend security layer for protected pages.

---

# 16. Application Routing

File:
src/App.jsx

Implemented routes:

Public:

* /login
* /register

Protected:

* /dashboard
* /dashboard/profile

Routing handled using:
React Router

---

# 17. Dashboard Layout System

Implemented:

* Navbar
* Sidebar
* Dashboard layout structure

Purpose:
Create scalable SaaS dashboard architecture.

Dashboard structure prepared for:

* inventory
* analytics
* alerts
* future modules

---

# 18. Dashboard Overview Page

File:
src/pages/dashboard/Dashboard.jsx

Features:

* welcome section
* pharmacy status
* inventory summary
* quick actions

Purpose:
Provide operational overview for pharmacy owner.

---

# 19. Pharmacy Profile Page

File:
src/pages/dashboard/Profile.jsx

Features:

* create pharmacy profile
* edit pharmacy details
* coordinate handling
* readonly license number
* profile update system

Connected with:
pharmacyService.js

---

# 20. Pharmacy Service (Frontend)

File:
src/services/pharmacyService.js

Purpose:
Handle all pharmacy-related frontend API communication.

Methods:

* createProfile()
* getProfile()
* updateProfile()

Benefits:

* cleaner components
* reusable API logic
* centralized request handling

---

# 21. Database Integration

Database:
Neon PostgreSQL

ORM:
Prisma

Flow:

Frontend →
Axios →
Express API →
Controller →
Service →
Prisma →
NeonDB

Successfully tested:

* pharmacy creation
* fetching profile
* updating profile
* authentication-protected access

---

# 22. Important Validation Logic

Implemented important business rule:

One pharmacy owner cannot create multiple pharmacy profiles.

Result:
Backend returns HTTP 409 Conflict.

Why important:
Ensures data integrity and ownership consistency.

---

# 23. UI/UX Achievements

Implemented:

* responsive dashboard structure
* modern authentication pages
* sidebar navigation
* reusable card-based layouts
* consistent design system

Prepared UI foundation for:

* inventory system
* medicine search
* analytics dashboard

---

# 24. Engineering Decisions Taken

## Why Modular Monolith?

Chosen because:

* easier development
* simpler deployment
* easier debugging
* sufficient for current scale

Microservices intentionally avoided.

---

## Why Context API Instead of Redux?

Current application complexity is manageable.

Redux would add:

* unnecessary boilerplate
* premature complexity

Context API is sufficient currently.

---

## Why Separate Service Layer?

Benefits:

* reusable business logic
* cleaner controllers
* easier testing
* maintainability

---

# 25. Challenges Faced

## Duplicate Profile Issue

Problem:
User attempted multiple pharmacy creations.

Solution:
Implemented duplicate ownership validation.

Result:
409 Conflict returned correctly.

---

## Frontend Auth Persistence

Challenge:
Maintaining login state after refresh.

Solution:
AuthContext + token persistence strategy.

---

# 26. Phase 2 Final Outcome

At the end of Phase 2, MASAS became:

* Full-stack application
* JWT-authenticated platform
* Database-connected system
* Protected dashboard application
* Scalable SaaS architecture

The project is now fully prepared for:

Phase 3 — Inventory Management System

---

# 27. What Comes Next (Phase 3)

Upcoming major features:

* Medicine catalog
* Inventory CRUD
* Stock management
* Expiry tracking
* Low stock alerts
* Medicine search
* Inventory analytics

Phase 3 will introduce the core operational logic of MASAS.

---

# 28. Key Learnings From Phase 2

Major engineering learnings:

* Full-stack integration
* JWT authentication flow
* Protected routing
* Modular backend architecture
* Context-based auth management
* API abstraction
* Service-layer architecture
* Database persistence
* SaaS dashboard structuring

---

# 29. Current System Status

Backend:
Stable

Frontend:
Functional and scalable

Authentication:
Working

Database:
Connected successfully

Dashboard:
Operational

Prepared for:
Inventory module implementation

---

# End of Phase 2 Documentation
