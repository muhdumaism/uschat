"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
async function requireAdmin(request, reply) {
    if (request.user?.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
}
