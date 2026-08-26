# MASAS — Phase 8 Documentation

# Real-Time, Notifications & Customer Alerts

> Phase 8 transformed MASAS from a pharmacy management tool into a **two-sided platform** where customers can search for medicines, save alerts, and get notified the moment a medicine becomes available — via push notifications, email, and in-app alerts.

**Author:** Anchit Gupta  
**Phase Status:** ✅ Complete  
**Sub-phases:** 8.1 → 8.11  
**Tests after Phase 8:** 268 (up from 129)  
**New tables:** 3 (notifications, saved_searches, availability_alerts)

---

## What Phase 8 Added — The Big Picture

Before Phase 8, MASAS was purely request-response. A pharmacy updates inventory → nothing happens until someone refreshes. A patient searches → if the medicine isn't available, tough luck, keep checking.

After Phase 8:

```
Pharmacy updates inventory
       ↓
Event Bus broadcasts the change
       ↓
   ┌───┴────────────┬─────────────────┐
   ↓                ↓                 ↓
Socket.io        Notification      Background
(instant push    (persisted in DB   Checker
to online        + email queued     (every 30 min,
users)           via BullMQ)        scans saved
                                    searches)
```

And a new **CUSTOMER** role means patients can register, save searches, and receive automated availability alerts.

---

## Phase-by-Phase Breakdown

### 8.1 — Event Bus

**Problem:** Services were tightly coupled. When inventory updated, nobody else knew about it.

**Solution:** A typed in-process event emitter that decouples producers from consumers.

**How it works:**
- When inventory is created/updated/deleted, or when an admin verifies/rejects a pharmacy, the service emits a named event (like `inventory.updated` or `pharmacy.verified`).
- Other parts of the system can subscribe to these events independently.
- The event bus is just Node.js `EventEmitter` with TypeScript typing — no external dependency.

**Key files:**
- `server/src/lib/eventBus.ts` — the typed emitter
- Events emitted from `inventory.service.ts` and `admin.service.ts`

**Why this matters:** Every feature in Phase 8 plugs into this bus. Adding a new side-effect (like sending an SMS) is just adding a new listener — no touching existing code.

---

### 8.2 — Socket.io (Real-Time Push)

**Problem:** REST is pull-based. Users don't see changes until they refresh.

**Solution:** Socket.io gives us server → client push over WebSockets.

**How it works:**
- When the server starts, Socket.io attaches to the same HTTP server (no extra port).
- Clients connect with their JWT token. The server verifies it and puts the socket into "rooms":
  - `user:{userId}` — for personal notifications
  - `pharmacy:{pharmacyId}` — for pharmacy-specific updates
  - `admin` — for admin broadcasts
- A "bridge" (`socketEventBridge.ts`) listens to Event Bus events and forwards them to the right Socket.io rooms.

**Key files:**
- `server/src/lib/socket.ts` — server socket setup with JWT auth
- `server/src/lib/socketEventBridge.ts` — event bus → socket forwarding
- `client/src/lib/socket.ts` + `client/src/context/SocketContext.tsx` — React integration

**Example flow:** Admin verifies a pharmacy → `pharmacy.verified` event → Socket.io pushes to `user:{pharmacyOwnerId}` → pharmacy owner's browser instantly shows a toast.

---

### 8.3 — Notification System (Persistent)

**Problem:** Socket.io only reaches users who are online. If a pharmacy gets verified at 2 AM, the owner misses it.

**Solution:** Every important event also creates a **database notification** that the user can read later.

**How it works:**
- `notificationEventBridge.ts` listens to Event Bus events and:
  1. Creates a `Notification` row in PostgreSQL (persisted forever)
  2. Pushes via Socket.io (instant, if online)
  3. Queues an email via BullMQ (reliable delivery)
- The `Notification` model has types: `PHARMACY_VERIFIED`, `PHARMACY_REJECTED`, `LOW_STOCK_ALERT`, `MEDICINE_AVAILABLE`, `SYSTEM_ANNOUNCEMENT`

**Key files:**
- `server/src/lib/notificationEventBridge.ts` — the central bridge
- `server/src/modules/notification/notification.service.ts` — CRUD operations

**Important design choice:** The socket bridge (8.2) handles real-time data sync (like inventory counts changing), while the notification bridge (8.3) handles things users need to know about later. They both listen to the same events independently — that's the power of the Event Bus pattern.

---

### 8.4 — Low-Stock Detection

**Problem:** Pharmacies have `quantity` but no concept of "stock is running low."

**Solution:** A **threshold crossing** detector that alerts only when stock drops below a configurable level.

**How it works:**
- Every `PharmacyInventory` item now has a `lowStockThreshold` field (default: 10).
- `lowStockDetector.ts` listens to `inventory.updated` and checks:
  - Was the previous quantity **above** the threshold?
  - Is the new quantity **at or below** the threshold?
  - If yes → emit `inventory.low_stock`
- This crossing logic prevents spam: going from 9 → 8 (already below) does NOT re-alert.

**Example:**
```
15 → 9  (threshold 10) → ✅ alert (crossed downward)
 9 → 8                  → ❌ no alert (already below)
 8 → 20                 → ❌ no alert (recovered)
20 → 7                  → ✅ alert (crossed again)
```

**Key file:** `server/src/lib/lowStockDetector.ts`

---

### 8.5 — BullMQ + Redis (Job Queue)

**Problem:** Email sending was synchronous and fire-and-forget. No retries, no observability. And later we need scheduled background jobs.

**Solution:** BullMQ (backed by Redis) gives us reliable job queuing with retries.

**How it works:**
- Any service can add a job to a queue: `emailQueue.add('verification-email', { to, name, verifyUrl })`
- The job goes to Redis (persists across server restarts)
- A worker picks it up and processes it
- If it fails, BullMQ retries automatically (3 attempts with exponential backoff: 2s → 4s → 8s)

**Two queues:**
- `emailQueue` — for all email sending
- `alertQueue` — for the 30-minute background checker (Phase 8.11)

**Key files:**
- `server/src/config/redis.ts` — Redis connection
- `server/src/jobs/queues.ts` — queue definitions

**New env var:** `REDIS_URL` (defaults to `redis://localhost:6379`)

---

### 8.6 — Email Worker

**Problem:** BullMQ gives us the queue, but something needs to actually process the jobs.

**Solution:** An email worker that picks jobs off the queue and sends emails using existing Nodemailer templates.

**How it works:**
- The worker processes 5 job types:
  - `verification-email` — account verification
  - `password-reset-email` — forgot password
  - `pharmacy-verified-email` — congratulations, you're verified
  - `pharmacy-rejected-email` — profile needs updates
  - `medicine-available-email` — a searched medicine is now available!
- Existing email calls in `auth.service.ts` were migrated from `sendVerificationEmail().catch(() => {})` to `emailQueue.add('verification-email', {...})`

**Key file:** `server/src/jobs/emailWorker.ts`

**Why this is better:** Before, if SMTP was slow, it blocked the API response. Now, `emailQueue.add()` returns instantly (just pushes to Redis), and the worker handles sending in the background.

---

### 8.7 — Notification API + UI

**Problem:** Notifications exist in the database (8.3), but there's no way for users to see or manage them.

**Solution:** REST API endpoints + a notification bell in the UI.

**API endpoints:**
| Method | Endpoint | What it does |
|---|---|---|
| `GET` | `/api/v1/notifications` | List your notifications (paginated) |
| `GET` | `/api/v1/notifications/unread-count` | Get the badge count |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark one as read |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all as read |
| `DELETE` | `/api/v1/notifications/:id` | Delete one |

**Client UI:**
- 🔔 bell icon in the Navbar with an unread count badge
- Dropdown showing recent notifications
- Real-time updates via Socket.io — new notifications appear instantly without refreshing
- "Mark all as read" button

**Key files:**
- `server/src/modules/notification/` — routes, controller, validation
- `client/src/components/layout/NotificationBell.tsx`
- `client/src/hooks/useNotifications.ts`

---

### 8.8 — CUSTOMER Role

**Problem:** MASAS only had `PHARMACY` and `ADMIN` roles. To become a two-sided platform, we need patients.

**Solution:** Add a `CUSTOMER` role that can search, save searches, and receive availability alerts.

**What changed:**
- `UserRole` enum: `CUSTOMER` | `PHARMACY` | `ADMIN`
- Registration accepts an optional `role` parameter (defaults to `PHARMACY` for backward compatibility)
- Registration UI has a role selector: "🔍 Patient" or "🏥 Pharmacy"
- Route access is enforced:

| Route | ADMIN | PHARMACY | CUSTOMER |
|---|---|---|---|
| Auth (login, register) | ✅ | ✅ | ✅ |
| Pharmacy management | ❌ | ✅ | ❌ |
| Inventory management | ❌ | ✅ | ❌ |
| Search (public) | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ |
| Saved Searches | ❌ | ❌ | ✅ |
| Admin panel | ✅ | ❌ | ❌ |

---

### 8.9 — Saved Searches

**Problem:** If a customer searches for a medicine and it's not available, they have to keep checking manually.

**Solution:** Customers can save a search (medicine name + location + radius) for automated checking later.

**How it works:**
- A saved search stores: `query` (medicine name), `latitude`, `longitude`, `radiusKm`, `isActive`
- Max 10 saved searches per customer
- Duplicate prevention: same query + same location = rejected
- Customers can pause/resume or delete their saved searches

**API:**
| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/api/v1/saved-searches` | Save a new search |
| `GET` | `/api/v1/saved-searches` | List your saved searches |
| `PATCH` | `/api/v1/saved-searches/:id` | Toggle active/inactive, change radius |
| `DELETE` | `/api/v1/saved-searches/:id` | Remove a saved search |

**Client:** SavedSearches page + "🔔 Alert me when available" button on the search page.

**Key files:** `server/src/modules/search/savedSearch.*`

---

### 8.10 — Availability Detection

**Problem:** Saved searches exist (8.9), but nothing acts on them yet when medicine becomes available.

**Solution:** Two detection paths that catch availability as fast as possible:

**Path 1 — Event-driven (instant):**
When a pharmacy adds or restocks inventory, `availabilityDetector.ts` immediately checks if any active saved search matches this new inventory (using PostGIS spatial queries). If yes → emit `medicine.availability_detected`.

**Path 2 — Poll-based (every 30 min):**
A background job (Phase 8.11) periodically scans all active saved searches and runs the same check.

**Deduplication — the tricky part:**
Without dedup, a customer would get "Paracetamol available!" every 30 minutes while stock exists. Two layers prevent this:

1. **`lastMatchAt` cooldown (per search):** Don't notify again within 24 hours for the same search.
2. **`AvailabilityAlert` table (per inventory item):** A row `(savedSearchId, inventoryId)` means "we already notified about this specific pharmacy's stock for this search." When stock drops to 0, the row is deleted — so restocking triggers a fresh alert.

**Failure-safe ordering in the bridge:**
```
1. Create notification in DB        ← if this fails, nothing persists
2. Queue email via BullMQ           ← if this fails, no dedup row created
3. Insert dedup row                 ← only created after 1 and 2 succeed
4. Push via Socket.io               ← best-effort, failure is OK
```
This ensures a failed notification can never permanently suppress future alerts.

**Key files:**
- `server/src/lib/availabilityDetector.ts` — event-driven path
- `server/src/modules/search/alert.service.ts` — shared detection logic
- `server/src/lib/notificationEventBridge.ts` — failure-safe bridge

---

### 8.11 — 30-Minute Background Checker

**Problem:** Event-driven detection (8.10) is instant but only catches *new* inventory changes. What about inventory that already existed when the customer saved their search?

**Solution:** A BullMQ repeatable job that runs every 30 minutes and scans all active saved searches.

**How it works:**
1. `alertScheduler.ts` registers a repeatable job: `*/30 * * * *` (every 30 min)
2. `alertWorker.ts` picks up the job and calls `alertService.processSearch()` for each active search in batches of 50
3. Each search runs a PostGIS query to find matching inventory
4. If matches found + cooldown passed + no dedup row → emit event → notification + email
5. If one search fails, the others still process (failure isolation)

**Why BullMQ instead of a simple cron?**
- Survives server restarts (the schedule lives in Redis, not memory)
- Multi-instance safe (only one worker picks up each job — no duplicate runs)
- Built-in failure tracking

**Multi-instance safety:**
On startup, the scheduler removes any stale repeatable jobs from previous deployments before registering a fresh one. BullMQ's Redis-backed locking ensures only one instance processes each job.

**Configurable:** Set `ALERT_CRON_PATTERN=*/2 * * * *` in `.env` for 2-minute checks during development.

**Key files:**
- `server/src/jobs/alertScheduler.ts`
- `server/src/jobs/alertWorker.ts`

---

## How Everything Connects

Here's the complete flow for a customer availability alert:

```
1. Customer registers as CUSTOMER role
2. Searches for "Paracetamol" near their location → no results
3. Clicks "Alert me when available" → SavedSearch created
4. Later, a pharmacy adds Paracetamol to their inventory
       ↓
5. inventory.service emits 'inventory.created' on Event Bus
       ↓
6. availabilityDetector picks it up, finds matching SavedSearch
       ↓
7. Runs PostGIS spatial query → pharmacy is within customer's radius
       ↓
8. Checks dedup → no existing alert for this inventory item
       ↓
9. Emits 'medicine.availability_detected' on Event Bus
       ↓
10. notificationEventBridge:
    a. Creates Notification in DB     → customer can read it later
    b. Queues email via BullMQ        → customer gets an email
    c. Inserts AvailabilityAlert row  → prevents duplicate notifications
    d. Pushes via Socket.io           → bell icon updates instantly
```

If the customer is offline, they'll see the notification when they log back in (step 10a persisted it). If they're online, they see it instantly (step 10d).

---

## New Database Tables

### notifications
Stores all notifications for all users. Each notification has a type, title, message, read/unread status, and optional JSON data.

### saved_searches
Stores customer search criteria: medicine name, GPS coordinates, radius, active/inactive status. Tracks when it was last checked and when a match was last found.

### availability_alerts
Deduplication table. Each row means "we already notified customer X about medicine Y being available at pharmacy Z." Deleted when stock drops to 0, so restocking triggers a fresh alert.

---

## New Dependencies

| Package | Purpose |
|---|---|
| `socket.io` / `socket.io-client` | Real-time WebSocket communication |
| `bullmq` | Job queue with scheduling, retries, and persistence |
| `ioredis` | Redis client (required by BullMQ) |

---

## Environment Variables Added

| Variable | Default | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection for BullMQ |
| `ALERT_CRON_PATTERN` | `*/30 * * * *` | How often to check saved searches |

---

## Test Coverage

Phase 8 added 139 new tests (129 → 268 total), spread across 8 new test files:

| Test File | Tests | What it covers |
|---|---|---|
| `eventBus.test.ts` | ~6 | Emit, subscribe, unsubscribe |
| `notification.test.ts` | ~20 | CRUD, pagination, filtering, bridge integration |
| `lowStock.test.ts` | 9 | Threshold crossing, recovery, bridge integration |
| `queues.test.ts` | 7 | Redis connectivity, queue operations |
| `emailWorker.test.ts` | 6 | Worker processes each job type |
| `savedSearch.test.ts` | ~12 | CRUD, limits, duplicates, role enforcement |
| `availabilityDetector.test.ts` | 19 | Detection, dedup, failure-safe lifecycle, race conditions |
| `alertService.test.ts` | 19 | Background checker, cooldowns, batch processing, cross-path dedup |
| `customer.test.ts` | ~8 | CUSTOMER role access control |

All 268 tests pass with Redis running. Zero skips, zero failures.
