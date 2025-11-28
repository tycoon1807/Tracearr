import type { FastifyPluginAsync } from 'fastify';

export const serverRoutes: FastifyPluginAsync = async (app) => {
  // GET /servers - List connected servers
  app.get('/', async (request, reply) => {
    return reply.notImplemented('List servers not yet implemented');
  });

  // POST /servers - Add server
  app.post('/', async (request, reply) => {
    return reply.notImplemented('Add server not yet implemented');
  });

  // DELETE /servers/:id - Remove server
  app.delete('/:id', async (request, reply) => {
    return reply.notImplemented('Remove server not yet implemented');
  });

  // POST /servers/:id/sync - Force sync
  app.post('/:id/sync', async (request, reply) => {
    return reply.notImplemented('Sync server not yet implemented');
  });
};
