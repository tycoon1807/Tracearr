import type { FastifyPluginAsync } from 'fastify';

export const ruleRoutes: FastifyPluginAsync = async (app) => {
  // GET /rules - List rules
  app.get('/', async (request, reply) => {
    return reply.notImplemented('List rules not yet implemented');
  });

  // POST /rules - Create rule
  app.post('/', async (request, reply) => {
    return reply.notImplemented('Create rule not yet implemented');
  });

  // PATCH /rules/:id - Update rule
  app.patch('/:id', async (request, reply) => {
    return reply.notImplemented('Update rule not yet implemented');
  });

  // DELETE /rules/:id - Delete rule
  app.delete('/:id', async (request, reply) => {
    return reply.notImplemented('Delete rule not yet implemented');
  });
};
