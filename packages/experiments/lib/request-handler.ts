import { Hono } from 'hono';

const app = new Hono();
export default app;

app.get('/invite/:invite_id', async c => {
  const server = c.get('server');
  let invite = await server.records.get('invites', c.req.param('invite_id'));
  if (invite.get('secret') !== c.req.query('sec')) return c.json({ message: 'unauthorized' }, 401);
  return c.json({ invite: invite.data(), access_token: 'fake-jwt-token' });
});

app.get('/identity', async c => {
  const server = c.get('server');
  return c.json(await server.getIdentity());
});

app.get('/collections/:collection/records/:id', async c => {
  const server = c.get('server');
  const collectionName = c.req.param('collection');
  const recordId = c.req.param('id');

  // todo: add this back when we have collections
  // if (!server.records[collectionName])
  //   return c.json({ message: `collection not found: ${collectionName}` }, 404);

  const record = await server.records.get(collectionName, recordId);
  if (!record) return c.json({ message: `${collectionName} record not found: ${recordId}` }, 404);
  return c.json(record);
});
