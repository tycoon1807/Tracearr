import type { FastifyPluginAsync } from 'fastify';

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  // GET /sessions - Query sessions
  app.get('/', async (request, reply) => {
    return reply.notImplemented('List sessions not yet implemented');
  });

  // GET /sessions/active - Currently active streams
  app.get('/active', async (request, reply) => {
    return reply.notImplemented('Get active sessions not yet implemented');
  });

  // GET /sessions/:id - Session detail
  app.get('/:id', async (request, reply) => {
    return reply.notImplemented('Get session not yet implemented');
  });
};
