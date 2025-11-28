import type { FastifyPluginAsync } from 'fastify';

export const violationRoutes: FastifyPluginAsync = async (app) => {
  // GET /violations - List violations
  app.get('/', async (request, reply) => {
    return reply.notImplemented('List violations not yet implemented');
  });

  // PATCH /violations/:id - Acknowledge violation
  app.patch('/:id', async (request, reply) => {
    return reply.notImplemented('Acknowledge violation not yet implemented');
  });

  // DELETE /violations/:id - Dismiss violation
  app.delete('/:id', async (request, reply) => {
    return reply.notImplemented('Dismiss violation not yet implemented');
  });
};
