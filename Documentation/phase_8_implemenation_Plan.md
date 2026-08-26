# Phase 8 — Real-Time, Notifications & Customer Alerts

Complete implementation blueprint with 11 sequential sub-phases. Each phase builds on the previous one.

> [!IMPORTANT]
**No code in this document.** This is the architectural plan a senior engineer prepares before writing the first line.
> 

---

## The System We're Building

By the end of Phase 8, every significant action in MASAS flows through this architecture:

```
                   MASAS
                     │
               Express Server
                     │
              ┌──────▼──────┐
              │  Event Bus  │
              └──────┬──────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
Socket.io       Notification       BullMQ
    │             Service            │
    │                │               ▼
    │                │             Redis
    │                │               │
    │                │               ▼
    │                │             Worker
    │                │               │
    │                │               ▼
    │                │             Email
    │                │
    ▼                ▼
 React            PostgreSQL
```

And customer alerts sit on top of that infrastructure:

```
Customer
   │
   ▼
Saved Search
   │
   ▼
BullMQ scheduled job (every 30 min)
   │
   ▼
Check Inventory + PostGIS
   │
   ├── Not available → nothing
   │
   └── Available
          │
          ▼
       Event Bus
          │
       ┌──┴─────┐
       ▼        ▼
   Socket.io   Email
       │        │
       ▼        ▼
   Customer  Customer
```

---

## Current State (After Phase 7)

| Area | What Exists |
| --- | --- |
| **Roles** | `ADMIN`, `PHARMACY` — 2 enum values in schema.prisma |
| **Modules** | 6 — auth, pharmacy, inventory, search, catalog, admin |
| **Database** | 9 tables, 2 enums, PostGIS on NeonDB |
| **Email** | Synchronous Nodemailer in email.ts — fire-and-forget with `.catch(() => {})` |
| **Real-time** | None — all communication is HTTP request/response |
| **Server entry** | `app.listen()` in index.ts — returns `http.Server`, but we don’t capture it |
| **Inventory** | `quantity` field in PharmacyInventory, no threshold concept |
| **Pattern** | Routes → Validation (Zod) → Controllers → Services → Prisma |
| **Tests** | 129 integration tests across 9 files in **tests** |

---

## Phase 8.1 — Event Bus

### The Problem

Right now, services are tightly coupled. When inventory updates:

```
Inventory Service → Prisma → Database → done.
```

Nobody else knows it happened. If we want Socket.io to push an update, or a notification to be created, or an email to be queued, we’d have to add all that logic directly inside `updateInventory()`. That’s messy and unscalable.

### The Solution

An in-process event emitter that decouples producers from consumers:

```
Inventory Service
      ↓
   Database
      ↓
   Event Bus  ──→  (nobody listens yet — and that’s fine)
```

The Inventory Service doesn’t care who consumes the event. It just says: “this happened.”

### Implementation

#### [NEW] `server/src/lib/eventBus.ts`

A typed wrapper around Node.js `EventEmitter`:

```tsx
// Typed event map — every event name maps to its payload shape
interface EventMap {
  'inventory.updated':    { inventoryId: string; pharmacyId: string; medicineId: string; medicineName: string; quantity: number; previousQuantity: number; };
  'inventory.created':    { inventoryId: string; pharmacyId: string; medicineId: string; medicineName: string; quantity: number; };
  'inventory.deleted':    { inventoryId: string; pharmacyId: string; medicineId: string; };
  'inventory.low_stock':  { inventoryId: string; pharmacyId: string; medicineId: string; medicineName: string; quantity: number; threshold: number; };

  'pharmacy.verified':    { pharmacyId: string; userId: string; pharmacyName: string; };
  'pharmacy.rejected':    { pharmacyId: string; userId: string; pharmacyName: string; reason?: string; };

  'user.registered':      { userId: string; email: string; name: string; role: string; };

  'medicine.availability_detected': { savedSearchId: string; userId: string; medicineName: string; pharmacyId: string; pharmacyName: string; price: number; distance: number; };
}

class TypedEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void
}

export const eventBus = new TypedEventBus();
```

**Why typed?** Because in 3 months, when someone adds a new listener, they get autocomplete and compile-time safety for the payload shape. Zero runtime cost.

**Why `EventEmitter` and not a library?** Node’s built-in `EventEmitter` is battle-tested, zero-dependency, and more than sufficient for in-process event dispatch. We’re not building distributed microservices — we’re building a monolith with clean internal boundaries.

### Wiring Into Existing Services

#### [MODIFY] inventory.service.ts

After the database write in `updateInventory()`, emit:

```tsx
// After: const updated = await prisma.pharmacyInventory.update(...)
eventBus.emit('inventory.updated', {
  inventoryId: updated.id,
  pharmacyId,
  medicineId: updated.medicineId,
  medicineName: updated.medicine.name,
  quantity: updated.quantity,
  previousQuantity: existing.quantity,  // We already fetch `existing` for the ownership check
});
```

Similarly:

- `addInventory()` → `inventory.created`
- `deleteInventory()` → `inventory.deleted`

#### [MODIFY] admin.service.ts

After `updatePharmacyStatus()`:

```tsx
// After: const updated = await prisma.pharmacy.update(...)
if (status === 'VERIFIED') {
  eventBus.emit('pharmacy.verified', {
    pharmacyId, userId: pharmacy.userId, pharmacyName: updated.name,
  });
} else if (status === 'REJECTED') {
  eventBus.emit('pharmacy.rejected', {
    pharmacyId, userId: pharmacy.userId, pharmacyName: updated.name, reason: rejectionReason,
  });
}
```

> [!NOTE]
At this point, nothing listens to these events. That’s intentional. We’re building infrastructure first, then plugging consumers in one by one.
> 

### Testing

- **Unit test `eventBus`**: emit → listener receives correct payload, unsubscribe works, typed payloads compile
- **Integration test**: update inventory → verify event was emitted (spy on `eventBus.emit`)
- ~6 tests in a new `eventBus.test.ts`

---

## Phase 8.2 — Socket.io

### The Problem

REST is pull-based. If a pharmacy’s verification status changes, their dashboard doesn’t know until they refresh. If inventory updates, connected admins don’t see it. We need server → client push.

### Architecture

```
Event Bus
    ↓
Socket.io listener (subscribes to events)
    ↓
io.to('user:{userId}').emit(...)
    ↓
React client receives in real-time
```

Socket.io becomes the first **consumer** of the Event Bus.

### Dependencies

| Package | Where | Version |
| --- | --- | --- |
| `socket.io` | server | `^4.x` |
| `socket.io-client` | client | `^4.x` |

### Server Changes

#### [MODIFY] index.ts — HTTP Server Refactor

Currently:

```tsx
app.listen(PORT, () => { ... });
```

After:

```tsx
import { createServer } from 'http';
const httpServer = createServer(app);
initSocket(httpServer);  // Attach Socket.io
httpServer.listen(PORT, () => { ... });
```

> [!IMPORTANT]
Socket.io requires attaching to the raw `http.Server` — not the Express app. This is the only structural change to the server entry point.
> 

#### [NEW] `server/src/lib/socket.ts` — Socket.io Setup

| Responsibility | Details |
| --- | --- |
| `initSocket(httpServer)` | Creates `Server` instance with CORS matching cors.ts |
| Auth middleware | `io.use()` — extracts JWT from `socket.handshake.auth.token`, verifies via existing verifyAccessToken() |
| Room management | On connect: join `user:{userId}`. If user has pharmacy: also join `pharmacy:{pharmacyId}`. If ADMIN: join `admin`. |
| Export | `getIO()` — returns the initialized `io` instance |

**Room design:**

```
user:{userId}          ← personal notifications (every user)
pharmacy:{pharmacyId}  ← pharmacy-specific events (inventory updates, verification)
admin                  ← admin broadcasts (new pharmacy registrations)
```

Why rooms and not socket maps? Because rooms handle multiple tabs/devices automatically. If a pharmacy owner has 3 tabs open, `io.to('pharmacy:P123')` reaches all 3. No manual tracking.

#### [NEW] `server/src/lib/socketEventBridge.ts` — Event Bus → Socket.io Bridge

This file subscribes to Event Bus events and forwards them to Socket.io rooms:

```tsx
// Called once during server startup
export function bridgeEventsToSocket(): void {
  eventBus.on('pharmacy.verified', (payload) => {
    getIO()?.to(`user:${payload.userId}`).emit('pharmacy:verified', payload);
  });

  eventBus.on('pharmacy.rejected', (payload) => {
    getIO()?.to(`user:${payload.userId}`).emit('pharmacy:rejected', payload);
  });

  eventBus.on('inventory.updated', (payload) => {
    getIO()?.to(`pharmacy:${payload.pharmacyId}`).emit('inventory:updated', payload);
  });

  eventBus.on('inventory.low_stock', (payload) => {
    getIO()?.to(`pharmacy:${payload.pharmacyId}`).emit('inventory:low_stock', payload);
  });
}
```

> [!TIP]
The `?.` null check on `getIO()` means this bridge is safe to import in tests where Socket.io isn’t initialized. Services and the Event Bus remain fully testable without Socket.io.
> 

#### Socket Events Spec

| Event | Direction | Room | Payload |
| --- | --- | --- | --- |
| `pharmacy:verified` | Server → Client | `user:{userId}` | `{ pharmacyId, pharmacyName }` |
| `pharmacy:rejected` | Server → Client | `user:{userId}` | `{ pharmacyId, pharmacyName, reason }` |
| `inventory:updated` | Server → Client | `pharmacy:{pharmacyId}` | `{ inventoryId, quantity, medicineName }` |
| `inventory:low_stock` | Server → Client | `pharmacy:{pharmacyId}` | `{ medicineName, quantity, threshold }` |
| `notification:new` | Server → Client | `user:{userId}` | Full notification object |
| `notification:count` | Server → Client | `user:{userId}` | `{ unreadCount }` |

### Client Changes

#### [NEW] `client/src/lib/socket.ts` — Client Socket Singleton

```tsx
// Creates a socket.io-client instance
// Connects to VITE_API_URL origin with auth token
// Exposes connect(), disconnect(), getSocket()
```

#### [NEW] `client/src/context/SocketContext.tsx`

Wraps socket lifecycle:

- **Connect** when `user` is available from AuthContext
- **Disconnect** on logout
- **Reconnect** with new token after refresh
- **Expose** `socket` instance + `isConnected` boolean

#### [MODIFY] main.tsx

Wrap with `<SocketProvider>` inside `<AuthProvider>`.

#### [MODIFY] AuthContext.tsx

On `logout()`, disconnect socket.

### No New Environment Variables

Socket.io runs on the same HTTP server and port. The client connects to the same origin as the API.

### Testing

- **Manual**: Open 2 browser tabs → admin verifies pharmacy → both tabs of the pharmacy user receive `pharmacy:verified` event in console
- **Unit**: Socket auth middleware rejects invalid/expired/missing JWT
- Socket bridge forwards events to the correct rooms

---

## Phase 8.3 — Notification System

### The Problem

Socket.io only delivers to users who are **online**. If a pharmacy gets verified at 2 AM, the owner misses it. We need persistent notifications.

### Architecture

Every event flows through two paths simultaneously:

```
Event Bus
    │
    ├──► PostgreSQL (persistent — always)
    │       └── Notification row
    │
    └──► Socket.io (instant — if user is online)
            └── Push to client
```

### Schema Changes

#### [MODIFY] schema.prisma

**New enum:**

```
enum NotificationType {
  PHARMACY_VERIFIED
  PHARMACY_REJECTED
  LOW_STOCK_ALERT
  MEDICINE_AVAILABLE
  SYSTEM_ANNOUNCEMENT
}
```

**New model:**

```
model Notification {
  id        String           @id @default(uuid())
  userId    String           @map("user_id")
  type      NotificationType
  title     String
  message   String
  data      Json?
  isRead    Boolean          @default(false) @map("is_read")
  createdAt DateTime         @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@map("notifications")
}
```

**Add to `User` model:** `notifications Notification[]`

### Migration

```bash
npx prisma migrate dev --name add-notifications
```

### New Service

#### [NEW] `server/src/modules/notification/notification.service.ts`

Pure data layer — knows nothing about Socket.io or email:

```tsx
const notificationService = {
  async create(data: { userId; type; title; message; data? }): Promise<Notification>,
  async listByUser(userId, { page, limit, unreadOnly? }): Promise<PaginatedResult>,
  async markAsRead(notificationId, userId): Promise<Notification>,
  async markAllAsRead(userId): Promise<{ count: number }>,
  async getUnreadCount(userId): Promise<number>,
  async deleteOld(daysOld: number): Promise<number>,
};
```

### Event Bus Listener — `notificationEventBridge.ts`

#### [NEW] `server/src/lib/notificationEventBridge.ts`

Subscribes to Event Bus events and creates persistent notifications:

```tsx
export function bridgeEventsToNotifications(): void {
  eventBus.on('pharmacy.verified', async (payload) => {
    const notification = await notificationService.create({
      userId: payload.userId,
      type: 'PHARMACY_VERIFIED',
      title: 'Pharmacy Verified! 🎉',
      message: `Your pharmacy "${payload.pharmacyName}" has been verified. You can now manage inventory.`,
      data: { pharmacyId: payload.pharmacyId },
    });
    // Also push via Socket.io for instant delivery
    getIO()?.to(`user:${payload.userId}`).emit('notification:new', notification);
  });

  eventBus.on('pharmacy.rejected', async (payload) => {
    const notification = await notificationService.create({
      userId: payload.userId,
      type: 'PHARMACY_REJECTED',
      title: 'Pharmacy Requires Updates',
      message: `Your pharmacy "${payload.pharmacyName}" was not approved. ${payload.reason || 'Please update your profile and resubmit.'}`,
      data: { pharmacyId: payload.pharmacyId, reason: payload.reason },
    });
    getIO()?.to(`user:${payload.userId}`).emit('notification:new', notification);
  });

  // low_stock listener will be added in Phase 8.4
  // medicine.availability_detected listener will be added in Phase 8.10
}
```

> [!NOTE]
Notice how the **socketEventBridge** (Phase 8.2) and **notificationEventBridge** (Phase 8.3) both listen to the same events independently. This is the power of the Event Bus: one event can trigger multiple side effects without the producer knowing.
> 

### Updating the Socket Bridge

#### [MODIFY] `server/src/lib/socketEventBridge.ts`

Remove the `pharmacy.verified` and `pharmacy.rejected` handlers from the socket bridge. Those are now handled by the notification bridge (which creates the DB row **and** emits Socket.io). This avoids duplicate socket emissions.

The socket bridge retains handlers for events that don’t need persistence (like `inventory.updated`, which is a real-time data sync, not a notification).

### Testing

- **New test file**: `notification.test.ts`
- **New test factory** in setup.ts: `createTestNotification(userId, overrides?)`
- **Update TRUNCATE** in `beforeEach` to include `"notifications"`
- ~10 tests:
    - Create notification → persisted correctly
    - List by user (pagination, ordering newest-first)
    - Mark single as read (owner only — 403 for wrong user)
    - Mark all as read (batch update count)
    - Unread count accuracy
    - Filter unread-only
    - Event Bus integration: emit `pharmacy.verified` → notification created in DB

---

## Phase 8.4 — Low-Stock Detection

### The Problem

Currently, inventory has `quantity` but no concept of “low.” Pharmacies don’t know stock is running low until it’s gone.

### Architecture

```
Inventory update (quantity changes)
         │
    Event Bus: 'inventory.updated'
         │
    Low-Stock Listener
         │
    Was above threshold → now at or below?
         │
    Yes → eventBus.emit('inventory.low_stock')
         │
    ├── Notification created
    └── Socket.io push to pharmacy dashboard
```

### Schema Changes

#### [MODIFY] schema.prisma — PharmacyInventory

Add one field:

```
lowStockThreshold Int @default(10) @map("low_stock_threshold")
```

### Migration

```bash
npx prisma migrate dev --name add-low-stock-threshold
```

### Validation Changes

#### [MODIFY] inventory.validation.ts

Add to both `addInventorySchema` and `updateInventorySchema`:

```tsx
lowStockThreshold: z.preprocess(
  preprocessInt,
  z.number().int().nonnegative('Threshold must be 0 or more').optional()
),
```

### Low-Stock Detection Logic

#### [NEW] `server/src/lib/lowStockDetector.ts`

Subscribes to `inventory.updated` and applies **threshold-crossing** logic:

```tsx
export function initLowStockDetector(): void {
  eventBus.on('inventory.updated', (payload) => {
    const { previousQuantity, quantity, threshold } = payload;

    // Only alert on CROSSING the threshold downward
    // previousQuantity > threshold AND quantity <= threshold
    const wasSafe = previousQuantity > threshold;
    const nowLow  = quantity <= threshold;

    if (wasSafe && nowLow) {
      eventBus.emit('inventory.low_stock', {
        inventoryId: payload.inventoryId,
        pharmacyId: payload.pharmacyId,
        medicineId: payload.medicineId,
        medicineName: payload.medicineName,
        quantity,
        threshold,
      });
    }
  });
}
```

**Why threshold crossing instead of an absolute check?** Without it:

```
quantity 9  → notification
quantity 8  → notification  ← spam
quantity 7  → notification  ← spam
```

With crossing:

```
quantity 15 → 9   → notification (crossed threshold of 10)
quantity 9  → 8   → nothing (already below, no crossing)
quantity 8  → 20  → nothing (recovered)
quantity 20 → 7   → notification (crossed again)
```

### Wiring

The existing `notificationEventBridge` gets a new listener:

```tsx
eventBus.on('inventory.low_stock', async (payload) => {
  // Find the pharmacy owner's userId
  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: payload.pharmacyId },
    select: { userId: true },
  });
  if (!pharmacy) return;

  const notification = await notificationService.create({
    userId: pharmacy.userId,
    type: 'LOW_STOCK_ALERT',
    title: `Low Stock: ${payload.medicineName}`,
    message: `Only ${payload.quantity} units remaining (threshold: ${payload.threshold}). Consider restocking.`,
    data: { inventoryId: payload.inventoryId, quantity: payload.quantity, threshold: payload.threshold },
  });

  getIO()?.to(`user:${pharmacy.userId}`).emit('notification:new', notification);
});
```

### Updating the Inventory Service

#### [MODIFY] inventory.service.ts — `updateInventory()`

The `inventory.updated` event payload (added in Phase 8.1) needs to include the threshold. We already fetch `existing` before the update, so:

```tsx
eventBus.emit('inventory.updated', {
  // ... existing fields ...
  previousQuantity: existing.quantity,
  threshold: existing.lowStockThreshold, // NEW — pass threshold into the event
});
```

Update the `EventMap` type in `eventBus.ts` to include `threshold` in `inventory.updated`.

### Testing

- ~8 tests:
    - `15 → 9` (threshold 10) → low stock event emitted
    - `9 → 8` (already below) → no event
    - `8 → 20` (recovery) → no event
    - `20 → 7` (cross again) → event emitted
    - `10 → 10` (exactly at threshold, no crossing) → no event
    - `11 → 10` (cross exactly to threshold) → event emitted
    - Threshold = 0 → low stock detection effectively disabled
    - Notification created when low_stock event fires

---

## Phase 8.5 — BullMQ + Redis

### The Problem

Currently, email sending in auth.service.ts uses fire-and-forget (`.catch(() => {})`). This works, but:

1. If the SMTP server is slow, it still consumes process resources
2. No retry on failure
3. No observability — failed emails vanish silently
4. Later: we need scheduled jobs (the 30-minute checker)

### Architecture

```
Any Service
    ↓
emailQueue.add('send-email', { ... })
    ↓
Redis (persists the job)
    ↓
Worker picks it up (separate processing loop)
    ↓
Nodemailer sends
    ↓
Success / Retry on failure
```

### Dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `bullmq` | `^5.x` | Job queue + scheduler |
| `ioredis` | `^5.x` | Redis client (required by BullMQ) |

### Infrastructure — Redis

| Environment | Redis Setup |
| --- | --- |
| **Local dev** | `brew install redis` or `docker run -p 6379:6379 redis:7-alpine` |
| **CI** | Redis service container in GitHub Actions |
| **Production** | Upstash (serverless free tier) or Redis Cloud |
| **Test** | Separate Redis DB index (`db: 1`), or BullMQ mocked |

### New Files

#### [NEW] `server/src/config/redis.ts` — Redis Connection

```tsx
// IORedis connection singleton
// Config from REDIS_URL env var
// Graceful disconnect on SIGTERM/SIGINT
// Export: redisConnection
```

#### [NEW] `server/src/jobs/queues.ts` — Queue Definitions

```tsx
import { Queue } from 'bullmq';

export const emailQueue = new Queue('email', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },    // Keep last 100 completed jobs
    removeOnFail: { count: 500 },        // Keep last 500 failed for debugging
  },
});

// Phase 8.11 will add: alertQueue
```

**Job types for `emailQueue`:**

| Job Name | Payload |
| --- | --- |
| `verification-email` | `{ to, name, verifyUrl }` |
| `password-reset-email` | `{ to, name, resetUrl }` |
| `notification-email` | `{ to, name, subject, title, message, actionUrl?, actionText? }` |
| `medicine-available-email` | `{ to, name, medicineName, pharmacyName, price, distance, searchUrl }` |

### Environment Variables

| Variable | Required | Default |
| --- | --- | --- |
| `REDIS_URL` | Yes (from 8.5 onward) | `redis://localhost:6379` |

#### [MODIFY] env.ts

Add `REDIS_URL` to config (optional with a default so existing deployments don’t break):

```tsx
REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
```

Add to `EnvConfig` type in types/index.ts.

### CI Changes

#### [MODIFY] ci.yml

Add a Redis service container alongside PostGIS in `test-server` job:

```yaml
services:
  postgres:
    # ... existing PostGIS config ...
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

Add `REDIS_URL: redis://localhost:6379` to the env block.

### Testing

- Verify Redis connection succeeds
- Verify the queue can add jobs
- BullMQ integration: add job → worker picks it up (tested in Phase 8.6)

---

## Phase 8.6 — Email Worker

### The Problem

BullMQ gives us the queue. Now we need the worker that processes the jobs.

### Architecture

```
Event Bus
    ↓
Notification Event Bridge
    ↓
emailQueue.add(...)       ← Producer (any bridge or service)
    ↓
Redis
    ↓
emailWorker               ← Consumer (processes jobs)
    ↓
Existing email.ts         ← Reuses your Phase 6 Nodemailer abstraction
    ↓
SMTP
```

> [!IMPORTANT]
We **reuse** the existing email.ts provider — `sendVerificationEmail()`, `sendPasswordResetEmail()`, etc. We’re extending MASAS, not replacing working pieces.
> 

### New Files

#### [NEW] `server/src/jobs/emailWorker.ts`

```tsx
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,       // NEW template — added below
  sendMedicineAvailableEmail,  // NEW template — added in Phase 8.10
} from '../utils/email.js';

const emailWorker = new Worker('email', async (job) => {
  switch (job.name) {
    case 'verification-email':
      await sendVerificationEmail(job.data.to, job.data.name, job.data.verifyUrl);
      break;
    case 'password-reset-email':
      await sendPasswordResetEmail(job.data.to, job.data.name, job.data.resetUrl);
      break;
    case 'notification-email':
      await sendNotificationEmail(job.data);
      break;
    // 'medicine-available-email' — added in Phase 8.10
  }
}, {
  connection: redisConnection,
  concurrency: 5,
});

// Error logging
emailWorker.on('failed', (job, err) => {
  logger.error('Email job failed', { jobId: job?.id, name: job?.name, error: err.message });
});
```

#### [MODIFY] email.ts — New Template

Add a generic notification email template:

```tsx
export async function sendNotificationEmail(data: {
  to: string;
  name: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): Promise<void>
```

Uses existing `baseTemplate()` + `buttonHtml()` with MASAS green branding.

### Migrate Existing Email Calls

#### [MODIFY] auth.service.ts

Replace synchronous calls with queue jobs:

| Before | After |
| --- | --- |
| `sendVerificationEmail(email, name, verifyUrl).catch(() => {})` | `await emailQueue.add('verification-email', { to: email, name, verifyUrl })` |
| `sendPasswordResetEmail(email, name, resetUrl).catch(() => {})` | `await emailQueue.add('password-reset-email', { to: email, name, resetUrl })` |

> [!WARNING]
The existing email calls in `auth.service.ts` use `.catch(() => {})` for fire-and-forget. After migrating to BullMQ, the `emailQueue.add()` call itself is near-instant (it just pushes to Redis). The actual send happens in the worker. If Redis is down, `emailQueue.add()` will throw — we should `.catch()` it too, or let it propagate depending on whether email delivery is critical for that flow.
> 

**Decision**: For registration and password reset, wrap `emailQueue.add()` in `.catch()` — the API should still succeed even if the email can’t be queued. The worker retries handle transient failures.

### Wiring Notification Emails

#### [MODIFY] `server/src/lib/notificationEventBridge.ts`

After creating a notification, also queue an email:

```tsx
eventBus.on('pharmacy.verified', async (payload) => {
  const notification = await notificationService.create({ ... });

  // Push instant via Socket.io
  getIO()?.to(`user:${payload.userId}`).emit('notification:new', notification);

  // Queue email
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true, name: true } });
  if (user) {
    emailQueue.add('notification-email', {
      to: user.email,
      name: user.name || '',
      subject: 'Your pharmacy has been verified — MASAS',
      title: notification.title,
      message: notification.message,
    }).catch(() => {});
  }
});
```

### Starting the Worker

#### [MODIFY] index.ts

```tsx
// Start email worker (self-initializing on import)
if (env.NODE_ENV !== 'test') {
  import('./jobs/emailWorker.js');
}
```

### Testing

- **Worker unit tests**: Mock Nodemailer transport, verify each job type calls the correct email function
- **Integration**: Add a job to the queue → verify worker processes it
- **Retry**: Mock SMTP failure → verify 3 retries with exponential backoff (2s, 4s, 8s)
- **Migration check**: Run existing auth tests → verify they still pass (email is now queued, not sent inline)

---

## Phase 8.7 — Notification API + UI

### The Problem

Notifications exist in the database (Phase 8.3) and are pushed via Socket.io (Phase 8.2), but there’s no way for users to **list, read, or manage** them via the REST API — and there’s no UI.

### Backend — Notification Module

#### [NEW] `server/src/modules/notification/notification.routes.ts`

#### [NEW] `server/src/modules/notification/notification.controller.ts`

#### [NEW] `server/src/modules/notification/notification.validation.ts`

Following the existing pattern: Routes → Validation → Controller → Service (service already exists from Phase 8.3).

### API Endpoints — `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Bearer | List own notifications (paginated, filterable) |
| `GET` | `/unread-count` | Bearer | Get unread count for badge |
| `PATCH` | `/:id/read` | Bearer | Mark a single notification as read |
| `PATCH` | `/read-all` | Bearer | Mark all as read |
| `DELETE` | `/:id` | Bearer | Delete a single notification |

#### Validation Schemas

```tsx
listNotificationsSchema (query):
  page:       z.string().optional().default('1') → number, min 1
  limit:      z.string().optional().default('20') → number, min 1, max 50
  unreadOnly: z.string().optional() → boolean ('true'/'false')

markAsReadSchema (params):
  id: z.string().uuid()
```

#### [MODIFY] app.ts

Register routes:

```tsx
import notificationRoutes from './modules/notification/notification.routes.js';
app.use('/api/v1/notifications', notificationRoutes);
```

### Frontend — Notification Bell

#### [NEW] `client/src/components/layout/NotificationBell.tsx`

- 🔔 icon in the Navbar, visible only for authenticated users
- Unread count badge (updates in real time via Socket.io `notification:new` event)
- Dropdown panel showing recent notifications
- Click notification → mark as read + navigate via `data.link` field
- “Mark all as read” button
- Uses `GET /notifications` for initial load, Socket.io for live updates

#### [NEW] `client/src/hooks/useNotifications.ts`

State management hook:

- Fetches initial notification list + unread count on mount
- Listens for `notification:new` Socket.io event → prepends to list, increments count
- Provides `markAsRead(id)`, `markAllAsRead()` — call API + update local state
- Re-syncs count when tab becomes visible (handles missed events while the tab was backgrounded)

#### [MODIFY] Navbar component

Add `<NotificationBell />` next to the user menu / avatar.

### Testing (~12 tests)

- `GET /notifications` — returns paginated, newest-first
- `GET /notifications?unreadOnly=true` — filters correctly
- `GET /notifications/unread-count` — returns correct count
- `PATCH /notifications/:id/read` — marks as read, returns updated
- `PATCH /notifications/:id/read` — 404 for non-existent notification
- `PATCH /notifications/:id/read` — 403 for notification owned by different user
- `PATCH /notifications/read-all` — batch update returns count
- `DELETE /notifications/:id` — owner only
- End-to-end: admin verifies pharmacy → `GET /notifications` returns the verification notification

---

## Phase 8.8 — CUSTOMER Role

### The Problem

MASAS currently has two roles: `PHARMACY` and `ADMIN`. It’s a pharmacy management system. To become a **two-sided platform**, we need a customer role — patients who search for medicines, save searches, and receive availability alerts.

### Schema Changes

#### [MODIFY] schema.prisma

```
enum UserRole {
  CUSTOMER
  PHARMACY
  ADMIN
}
```

This is a non-breaking, additive change. PostgreSQL `ALTER TYPE ADD VALUE` is handled by Prisma automatically.

### Migration

```bash
npx prisma migrate dev --name add-customer-role
```

### Backend Changes

#### [MODIFY] auth.service.ts — Registration

Currently, `register()` hardcodes `role: 'PHARMACY'` (line 53).

Change: accept an optional `role` parameter, default to `'PHARMACY'`:

```tsx
async register({ name, email, password, role = 'PHARMACY' }: RegisterInput, req: Request) {
  // Block ADMIN registration (already protected, but explicit)
  if (role === 'ADMIN') {
    throw ApiError.forbidden('Admin accounts cannot be created through registration');
  }

  const user = await prisma.user.create({
    data: { email, name, passwordHash, role, isEmailVerified: false },
    // ...
  });
}
```

#### [MODIFY] auth.validation.ts

Add to register schema:

```tsx
role: z.enum(['PHARMACY', 'CUSTOMER']).optional().default('PHARMACY'),
```

#### [MODIFY] Google Auth Flow

Same logic: accept an optional `role` in the Google auth body. New Google users get the passed role (default `PHARMACY`). Existing users keep their existing role.

#### [MODIFY] types/index.ts

Update `AccessTokenPayload` and `AuthenticatedRequest`:

```tsx
role: 'PHARMACY' | 'ADMIN' | 'CUSTOMER';
```

#### [MODIFY] authorize.ts

No change needed — it already accepts `...allowedRoles: string[]`.

### Route Access Matrix

| Route | ADMIN | PHARMACY | CUSTOMER |
| --- | --- | --- | --- |
| `/api/v1/auth/*` | ✅ | ✅ | ✅ |
| `/api/v1/pharmacy/*` | ❌ | ✅ | ❌ |
| `/api/v1/inventory/*` | ❌ | ✅ | ❌ |
| `/api/v1/search/*` | ✅ | ✅ | ✅ (public) |
| `/api/v1/catalog/*` | ✅ | ✅ | ✅ |
| `/api/v1/admin/*` | ✅ | ❌ | ❌ |
| `/api/v1/notifications/*` | ✅ | ✅ | ✅ |
| `/api/v1/saved-searches/*` | ❌ | ❌ | ✅ (Phase 8.9) |

### Client Changes

#### [MODIFY] Registration Flow — Register.tsx

Add a role selector at the top of the form:

```
┌─────────────────────────────────┐
│  I am a:                        │
│  ┌──────────┐  ┌──────────────┐ │
│  │ 🔍 Patient │  │ 🏥 Pharmacy │ │
│  └──────────┘  └──────────────┘ │
│                                  │
│  [Existing registration form]    │
└─────────────────────────────────┘
```

- Patient → sends `role: 'CUSTOMER'`
- Pharmacy → sends `role: 'PHARMACY'` (existing behavior)
- CUSTOMER registration hides pharmacy-specific hints/text

#### [MODIFY] Post-Login Routing

| Role | Redirect |
| --- | --- |
| `PHARMACY` | `/dashboard` (existing) |
| `ADMIN` | `/admin` (existing) |
| `CUSTOMER` | `/search` (new default home) |

#### [MODIFY] ProtectedRoute.tsx

When `CUSTOMER` tries to access pharmacy-only routes, redirect to `/search` instead of `/dashboard`.

#### [MODIFY] AuthContext.tsx

Update `User` interface: `role: 'PHARMACY' | 'ADMIN' | 'CUSTOMER'`.

### Testing

- Register as CUSTOMER → success, role is CUSTOMER
- CUSTOMER cannot access `POST /pharmacy/profile` → 403
- CUSTOMER cannot access `POST /inventory` → 403
- CUSTOMER can access `GET /search/inventory` → 200
- CUSTOMER can access `GET /notifications` → 200
- Google auth with `role: 'CUSTOMER'` → creates CUSTOMER user
- ADMIN via registration → 403 (existing; verify non-regression)
- Existing PHARMACY registration → still works (default role)

---

## Phase 8.9 — Saved Searches

### The Problem

Customers can search for medicines, but if it’s not available now, they have to keep checking manually. Saved searches store criteria for automated checks later.

### Schema Changes

#### [MODIFY] schema.prisma

**New model:**

```
model SavedSearch {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  query         String                              // Medicine name (e.g., "azithromycin")
  latitude      Float
  longitude     Float
  radiusKm      Float     @default(5) @map("radius_km")
  isActive      Boolean   @default(true) @map("is_active")
  lastCheckedAt DateTime? @map("last_checked_at")   // Last cron check
  lastMatchAt   DateTime? @map("last_match_at")     // Last time results were found
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, query, latitude, longitude])    // Prevent duplicate saves
  @@index([userId, isActive])
  @@index([isActive, lastCheckedAt])                // For the cron query
  @@map("saved_searches")
}
```

**Add to `User` model:** `savedSearches SavedSearch[]`

**Constraint**: Max 10 saved searches per user (enforced in service layer, not schema).

### Migration

```bash
npx prisma migrate dev --name add-saved-searches
```

### New Module — `saved-search`

#### Directory: `server/src/modules/saved-search/`

| File | Responsibility |
| --- | --- |
| `savedSearch.routes.ts` | Route definitions with Swagger JSDoc |
| `savedSearch.controller.ts` | HTTP handlers |
| `savedSearch.service.ts` | Business logic |
| `savedSearch.validation.ts` | Zod schemas |

### API Endpoints — `/api/v1/saved-searches`

| Method | Endpoint | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Bearer | CUSTOMER | Create a saved search |
| `GET` | `/` | Bearer | CUSTOMER | List own saved searches |
| `PATCH` | `/:id` | Bearer | CUSTOMER | Update (toggle active, change radius) |
| `DELETE` | `/:id` | Bearer | CUSTOMER | Remove a saved search |

#### Validation Schemas

```tsx
createSavedSearchSchema (body):
  query:     z.string().min(2).max(200).trim()
  latitude:  z.number().min(-90).max(90)
  longitude: z.number().min(-180).max(180)
  radiusKm:  z.number().min(1).max(50).default(5)

updateSavedSearchSchema (body):
  isActive:  z.boolean().optional()
  radiusKm:  z.number().min(1).max(50).optional()
```

#### Service Logic

```tsx
const savedSearchService = {
  async create(userId, data) {
    // 1. Count existing → if >= 10, throw ApiError.badRequest
    // 2. Check uniqueness (query + location) → if exists, throw ApiError.conflict
    // 3. Create and return
  },

  async listByUser(userId) {
    // All saved searches, ordered by createdAt desc
  },

  async update(id, userId, data) {
    // Owner check → update
  },

  async delete(id, userId) {
    // Owner check → delete
  },

  /** Used by the 30-minute checker (Phase 8.11) */
  async getActiveSearchesBatch(batchSize: number, olderThanMinutes: number) {
    // WHERE isActive = true
    // AND (lastCheckedAt IS NULL OR lastCheckedAt < NOW() - interval)
    // ORDER BY lastCheckedAt ASC NULLS FIRST
    // LIMIT batchSize
  },

  async updateLastChecked(id: string, matched: boolean) {
    // Update lastCheckedAt, and lastMatchAt if matched
  },
};
```

### Route Registration

#### [MODIFY] app.ts

```tsx
import savedSearchRoutes from './modules/saved-search/savedSearch.routes.js';
app.use('/api/v1/saved-searches', savedSearchRoutes);
```

### Client Changes

#### [NEW] `client/src/pages/SavedSearches.tsx`

- List of saved searches with toggle (active/inactive)
- Delete action
- Shows last match time, search query, radius

#### [MODIFY] Search.tsx

For `CUSTOMER` users, after performing a search, show an “🔔 Alert me when available” button if there are no results (or few results). If it’s already saved, show “Saved ✓” with an option to remove.

#### [MODIFY] App.tsx

Add route:

```tsx
<Route path="/saved-searches" element={
  <ProtectedRoute roles={['CUSTOMER']}>
    <SavedSearches />
  </ProtectedRoute>
} />
```

### Testing (~10 tests)

- Create saved search → success
- Create > 10 → 400 limit reached
- Create duplicate (same query + location) → 409 conflict
- List own searches → correct results, ordered
- Toggle active/inactive → success
- Update radius → success
- Delete → success
- PHARMACY role → 403
- ADMIN role → 403
- Multi-user isolation: user A cannot see user B’s saved searches

### Update Test Infrastructure

- **TRUNCATE** in setup.ts → include `"saved_searches"`
- **New factory**: `createTestSavedSearch(userId, overrides?)`

---

## Phase 8.10 — Availability Alerts

### The Problem

Saved searches exist (Phase 8.9), but they’re just data. Nothing acts on them yet. This phase connects the detection logic to the notification system.

### Architecture

When a medicine becomes available that matches a saved search, the system should:

```
Medicine availability detected
         ↓
    Event Bus: 'medicine.availability_detected'
         ↓
    ┌────┴─────┐
    ▼          ▼
Notification   Email Queue
    │          │
    ▼          ▼
PostgreSQL   BullMQ → Worker → SMTP
    │
    ▼
Socket.io → Customer (if online)
```

### Alert Service

#### [NEW] `server/src/modules/saved-search/alert.service.ts`

This service is called by the 30-minute checker (Phase 8.11), but the processing logic lives here:

```tsx
const alertService = {
  /**
   * Process a single saved search.
   * Called by the background checker.
   */
  async processSearch(search: SavedSearch): Promise<void> {
    // 1. Run PostGIS query — reuse existing searchPublicInventory() logic
    const results = await searchPublicInventory({
      q: search.query,
      lat: search.latitude,
      lng: search.longitude,
      radiusKm: search.radiusKm,
      page: 1,
      limit: 5,
    });

    const hasMatches = results.total > 0;

    // 2. Update lastCheckedAt (always)
    await savedSearchService.updateLastChecked(search.id, hasMatches);

    // 3. If matches found AND should notify (deduplication)
    if (hasMatches && this.shouldNotify(search)) {
      const top = results.results[0];

      eventBus.emit('medicine.availability_detected', {
        savedSearchId: search.id,
        userId: search.userId,
        medicineName: search.query,
        pharmacyId: top.pharmacy.id,
        pharmacyName: top.pharmacy.name,
        price: top.inventory.price,
        distance: top.distanceMeters,
      });
    }
  },

  /**
   * Deduplication: only notify if no match in the last 24 hours.
   * Prevents "Paracetamol available!" every 30 minutes while stock exists.
   */
  shouldNotify(search: SavedSearch): boolean {
    if (!search.lastMatchAt) return true;
    const hoursSinceLastMatch = (Date.now() - search.lastMatchAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMatch >= 24;
  },
};
```

### Event Bridge Listener

#### [MODIFY] `server/src/lib/notificationEventBridge.ts`

Add listener for `medicine.availability_detected`:

```tsx
eventBus.on('medicine.availability_detected', async (payload) => {
  // 1. Create notification
  const notification = await notificationService.create({
    userId: payload.userId,
    type: 'MEDICINE_AVAILABLE',
    title: `${payload.medicineName} is now available!`,
    message: `Found at ${payload.pharmacyName} — ₹${payload.price}`,
    data: {
      savedSearchId: payload.savedSearchId,
      pharmacyId: payload.pharmacyId,
      pharmacyName: payload.pharmacyName,
      price: payload.price,
      distance: payload.distance,
      link: `/pharmacy/${payload.pharmacyId}`,
    },
  });

  // 2. Push via Socket.io
  getIO()?.to(`user:${payload.userId}`).emit('notification:new', notification);

  // 3. Queue email
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, name: true },
  });
  if (user) {
    emailQueue.add('medicine-available-email', {
      to: user.email,
      name: user.name || '',
      medicineName: payload.medicineName,
      pharmacyName: payload.pharmacyName,
      price: payload.price,
      distance: `${(payload.distance / 1000).toFixed(1)} km`,
      searchUrl: `${env.CLIENT_URL}/pharmacy/${payload.pharmacyId}`,
    }).catch(() => {});
  }
});
```

### New Email Template

#### [MODIFY] email.ts

```tsx
export async function sendMedicineAvailableEmail(data: {
  to: string;
  name: string;
  medicineName: string;
  pharmacyName: string;
  price: number;
  distance: string;
  searchUrl: string;
}): Promise<void>
```

Uses existing `baseTemplate()` with:

- Title: “Good news! [Medicine] is available”
- Body: pharmacy name, price, distance
- CTA button: “View Pharmacy”

### Email Worker Update

#### [MODIFY] `server/src/jobs/emailWorker.ts`

Add case:

```tsx
case 'medicine-available-email':
  await sendMedicineAvailableEmail(job.data);
  break;
```

### Testing

- `processSearch()` with matching inventory → `medicine.availability_detected` event emitted
- `processSearch()` with no matches → no event, `lastCheckedAt` updated
- `shouldNotify()` with `lastMatchAt` null → true
- `shouldNotify()` with `lastMatchAt` 2 hours ago → false (within 24h window)
- `shouldNotify()` with `lastMatchAt` 25 hours ago → true
- Integration: event → notification created + email queued

---

## Phase 8.11 — 30-Minute Background Checker

### The Problem

Alert logic exists (Phase 8.10), but nothing triggers it. We need a scheduled background process that runs every 30 minutes, scans active saved searches, and calls the alert service.

### Architecture

```
BullMQ Scheduler
       ↓
Every 30 minutes
       ↓
alertQueue: 'check-availability'
       ↓
Redis
       ↓
Alert Worker
       ↓
For each active SavedSearch:
       ↓
  alertService.processSearch(search)
       ↓
  PostGIS inventory query
       ↓
  Match? → Event Bus → Notification + Socket + Email
```

### Why BullMQ Instead of node-cron?

We already have BullMQ (Phase 8.5). BullMQ has built-in **repeatable jobs** that:

- Survive server restarts (job is in Redis, not in-memory)
- Don’t double-fire in multi-instance deployments (only one worker picks the job)
- Have built-in failure tracking and retry
- Are observable via BullMQ Dashboard if we ever add one

`node-cron` is in-memory: if the server crashes mid-cycle, the job is lost. If we deploy 2 instances, both fire. BullMQ solves both.

### Implementation

#### [MODIFY] `server/src/jobs/queues.ts`

Add the alert queue:

```tsx
export const alertQueue = new Queue('alerts', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,            // Don’t retry the whole cycle — individual search failures are caught
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});
```

#### [NEW] `server/src/jobs/alertScheduler.ts`

Registers the repeatable job (called once at startup):

```tsx
export async function startAlertScheduler(): Promise<void> {
  // Remove any stale repeatable jobs from previous deployments
  const existing = await alertQueue.getRepeatableJobs();
  for (const job of existing) {
    await alertQueue.removeRepeatableByKey(job.key);
  }

  // Schedule: every 30 minutes
  await alertQueue.add('check-availability', {}, {
    repeat: { pattern: '*/30 * * * *' },
  });

  logger.info('🔔 Alert scheduler registered: every 30 minutes');
}
```

#### [NEW] `server/src/jobs/alertWorker.ts`

```tsx
const BATCH_SIZE = 50;

const alertWorker = new Worker('alerts', async (job) => {
  if (job.name === 'check-availability') {
    logger.info('🔔 Alert cycle starting');

    const searches = await savedSearchService.getActiveSearchesBatch(BATCH_SIZE, 30);
    logger.info(`🔔 Processing ${searches.length} saved searches`);

    let matched = 0;
    let failed = 0;

    for (const search of searches) {
      try {
        await alertService.processSearch(search);
        // Check if a match was found (lastMatchAt updated)
        // Simplification: alertService.processSearch returns void,
        // we track via the event bus
      } catch (error) {
        failed++;
        logger.error('Alert processing failed for search', {
          searchId: search.id,
          error: (error as Error).message,
        });
        // Continue with next search — don’t let one failure block the batch
      }
    }

    logger.info(`🔔 Alert cycle complete`, { processed: searches.length, failed });
  }
}, {
  connection: redisConnection,
  concurrency: 1,  // Only one alert cycle at a time
});
```

### Server Startup

#### [MODIFY] index.ts

```tsx
if (env.NODE_ENV !== 'test') {
  import('./jobs/emailWorker.js');     // Phase 8.6
  import('./jobs/alertWorker.js');     // Phase 8.11

  // Start the scheduler after workers are ready
  import('./jobs/alertScheduler.js').then(m => m.startAlertScheduler());
}
```

> [!TIP]
Guard with `NODE_ENV !== 'test'` to prevent workers and cron from firing during test runs.
> 

### Configurable Interval

For local development, support overriding the cron pattern:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ALERT_CRON_PATTERN` | `*/30 * * * *` | Cron expression for the background checker |

This lets developers set `ALERT_CRON_PATTERN=*/2 * * * *` for 2-minute checks during dev.

### Testing

- **Unit**: `alertService.processSearch()` — already tested in Phase 8.10
- **Integration**: Create saved search + matching inventory → manually trigger `check-availability` job → verify notification created
- **No-match**: Create saved search without matching inventory → trigger job → verify no notification, `lastCheckedAt` updated
- **Batch processing**: Create 3 saved searches (2 with matches, 1 without) → verify correct outcomes for each
- **Failure isolation**: Mock one search to throw → verify others still process

---

## Complete File Summary

### New Files (22 files)

| Layer | File | Phase |
| --- | --- | --- |
| Server Lib | `src/lib/eventBus.ts` | 8.1 |
| Server Lib | `src/lib/socket.ts` | 8.2 |
| Server Lib | `src/lib/socketEventBridge.ts` | 8.2 |
| Server Lib | `src/lib/notificationEventBridge.ts` | 8.3 |
| Server Lib | `src/lib/lowStockDetector.ts` | 8.4 |
| Server Config | `src/config/redis.ts` | 8.5 |
| Server Jobs | `src/jobs/queues.ts` | 8.5 |
| Server Jobs | `src/jobs/emailWorker.ts` | 8.6 |
| Server Jobs | `src/jobs/alertScheduler.ts` | 8.11 |
| Server Jobs | `src/jobs/alertWorker.ts` | 8.11 |
| Server Module | `src/modules/notification/notification.service.ts` | 8.3 |
| Server Module | `src/modules/notification/notification.routes.ts` | 8.7 |
| Server Module | `src/modules/notification/notification.controller.ts` | 8.7 |
| Server Module | `src/modules/notification/notification.validation.ts` | 8.7 |
| Server Module | `src/modules/saved-search/savedSearch.service.ts` | 8.9 |
| Server Module | `src/modules/saved-search/savedSearch.routes.ts` | 8.9 |
| Server Module | `src/modules/saved-search/savedSearch.controller.ts` | 8.9 |
| Server Module | `src/modules/saved-search/savedSearch.validation.ts` | 8.9 |
| Server Module | `src/modules/saved-search/alert.service.ts` | 8.10 |
| Client | `src/lib/socket.ts` | 8.2 |
| Client | `src/context/SocketContext.tsx` | 8.2 |
| Client | `src/hooks/useNotifications.ts` | 8.7 |
| Client | `src/components/layout/NotificationBell.tsx` | 8.7 |
| Client | `src/pages/SavedSearches.tsx` | 8.9 |
| Tests | `src/__tests__/eventBus.test.ts` | 8.1 |
| Tests | `src/__tests__/notification.test.ts` | 8.3/8.7 |
| Tests | `src/__tests__/lowStock.test.ts` | 8.4 |
| Tests | `src/__tests__/savedSearch.test.ts` | 8.9 |
| Tests | `src/__tests__/alert.test.ts` | 8.10/8.11 |

### Modified Files (15 files)

| File | Phases | Change |
| --- | --- | --- |
| schema.prisma | 8.3, 8.4, 8.8, 8.9 | New models, enum, field, role |
| index.ts | 8.2, 8.6, 8.11 | HTTP server refactor, workers, scheduler |
| app.ts | 8.7, 8.9 | New route registrations |
| env.ts | 8.5 | REDIS_URL |
| types/index.ts | 8.5, 8.8 | REDIS_URL in EnvConfig, CUSTOMER role |
| email.ts | 8.6, 8.10 | New templates |
| inventory.service.ts | 8.1, 8.4 | Event emissions, threshold in payload |
| inventory.validation.ts | 8.4 | lowStockThreshold field |
| admin.service.ts | 8.1 | Event emissions |
| auth.service.ts | 8.6, 8.8 | Email queue, customer role |
| auth.validation.ts | 8.8 | Role field in register |
| setup.ts | 8.3, 8.8, 8.9 | Factories, TRUNCATE, types |
| ci.yml | 8.5 | Redis service container |
| App.tsx | 8.7, 8.8, 8.9 | New routes |
| AuthContext.tsx | 8.2, 8.8 | Socket disconnect, CUSTOMER type |
| ProtectedRoute.tsx | 8.8 | CUSTOMER redirect |
| Register.tsx | 8.8 | Role selector |
| Search.tsx | 8.9 | Save search button |

---

## New Dependencies

| Package | Version | Phase | Where |
| --- | --- | --- | --- |
| `socket.io` | `^4.x` | 8.2 | server |
| `socket.io-client` | `^4.x` | 8.2 | client |
| `bullmq` | `^5.x` | 8.5 | server |
| `ioredis` | `^5.x` | 8.5 | server |

> [!NOTE]
No `node-cron` needed — BullMQ’s repeatable jobs replace it entirely. Fewer dependencies.
> 

---

## New Environment Variables

| Variable | Required | Default | Phase |
| --- | --- | --- | --- |
| `REDIS_URL` | Yes (8.5+) | `redis://localhost:6379` | 8.5 |
| `ALERT_CRON_PATTERN` | No | `*/30 * * * *` | 8.11 |

---

## Database After Phase 8

```
Before:  9 tables, 2 enums
After:  11 tables, 3 enums

New tables:      notifications, saved_searches
New enum:        NotificationType
Modified enum:   UserRole (+ CUSTOMER)
Modified model:  PharmacyInventory (+ lowStockThreshold)
```

---

## Verification Plan

### Automated Tests

```bash
# Full suite (expects ~190+ tests after Phase 8)
cd server && npm run test

# Phase-specific
npm run test -- eventBus.test.ts
npm run test -- notification.test.ts
npm run test -- lowStock.test.ts
npm run test -- savedSearch.test.ts
npm run test -- alert.test.ts

# Non-regression (existing tests still pass)
npm run test -- auth.test.ts auth-enhanced.test.ts inventory.test.ts admin.test.ts search.test.ts
```

### Build Verification

```bash
# Backend typecheck
cd server && npm run typecheck

# Frontend build
cd client && npm run build

# CI — verify GitHub Actions passes with Redis + PostGIS
git push
```

### Manual End-to-End Verification

| Phase | Manual Test |
| --- | --- |
| 8.1 | Update inventory → check server logs for event emission |
| 8.2 | Open 2 tabs → admin verifies pharmacy → both tabs receive socket event |
| 8.3 | Verify pharmacy → check DB for notification row |
| 8.4 | Update inventory from 15 → 8 (threshold 10) → low stock notification appears |
| 8.5 | Check Redis connection on startup (`redis-cli ping`) |
| 8.6 | Register user → verify email arrives via BullMQ worker (check worker logs) |
| 8.7 | Click 🔔 bell → dropdown shows notifications → mark as read works |
| 8.8 | Register as Customer → verify cannot access pharmacy routes → can search |
| 8.9 | Search medicine → save it → view in "Saved Searches" → toggle active |
| 8.10 | Create saved search for "paracetamol" → add matching inventory → manually trigger alert → notification + email |
| 8.11 | Watch server logs → alert cycle fires every 30 min → processes saved searches |