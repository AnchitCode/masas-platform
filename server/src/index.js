const env = require('./config/env');
const logger = require('./utils/logger');
const app = require('./app');

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`🚀 MASAS server running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);
});
