import env from './config/env.js';
import logger from './utils/logger.js';
import app from './app.js';

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`🚀 MASAS server running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);
});
