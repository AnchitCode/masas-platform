import { createServer } from 'http';
import env from './config/env.js';
import logger from './utils/logger.js';
import app from './app.js';
import { initSocket } from './lib/socket.js';
import { bridgeEventsToSocket } from './lib/socketEventBridge.js';
import { bridgeEventsToNotifications } from './lib/notificationEventBridge.js';
import { initLowStockDetector } from './lib/lowStockDetector.js';
import { initAvailabilityDetector } from './lib/availabilityDetector.js';
import { emailWorker } from './jobs/emailWorker.js';
import { alertWorker } from './jobs/alertWorker.js';
import { startAlertScheduler } from './jobs/alertScheduler.js';

const PORT = env.PORT;

// Create explicit HTTP server — required for Socket.io to attach to
const httpServer = createServer(app);

// Initialize Socket.io (skip in test — tests use supertest which creates its own server)
if (env.NODE_ENV !== 'test') {
  initSocket(httpServer);
  bridgeEventsToSocket();
  bridgeEventsToNotifications();
  initLowStockDetector();
  initAvailabilityDetector();

  // Start the alert scheduler after the event infrastructure is ready
  startAlertScheduler().catch((err) => {
    logger.error('Failed to start alert scheduler', { error: String(err) });
  });
}

httpServer.listen(PORT, () => {
  logger.info(`🚀 MASAS server running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await Promise.allSettled([
    emailWorker.close(),
    alertWorker.close(),
  ]);
  httpServer.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
