import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { API_BASE_PATH } from '@tracearr/shared';

import { authRoutes } from './routes/auth.js';
import { serverRoutes } from './routes/servers.js';
import { userRoutes } from './routes/users.js';
import { sessionRoutes } from './routes/sessions.js';
import { ruleRoutes } from './routes/rules.js';
import { violationRoutes } from './routes/violations.js';
import { statsRoutes } from './routes/stats.js';
import { settingsRoutes } from './routes/settings.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Utility plugins
  await app.register(sensible);
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET,
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // API routes
  await app.register(authRoutes, { prefix: `${API_BASE_PATH}/auth` });
  await app.register(serverRoutes, { prefix: `${API_BASE_PATH}/servers` });
  await app.register(userRoutes, { prefix: `${API_BASE_PATH}/users` });
  await app.register(sessionRoutes, { prefix: `${API_BASE_PATH}/sessions` });
  await app.register(ruleRoutes, { prefix: `${API_BASE_PATH}/rules` });
  await app.register(violationRoutes, { prefix: `${API_BASE_PATH}/violations` });
  await app.register(statsRoutes, { prefix: `${API_BASE_PATH}/stats` });
  await app.register(settingsRoutes, { prefix: `${API_BASE_PATH}/settings` });

  return app;
}

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
