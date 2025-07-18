import { Hono } from 'hono';

interface Variables {
  collectionName: string;
}

const app = new Hono<{ Variables: Variables }>();
export default app;

app.use('*', async (c, next) => {
  c.set('collectionName', c.req.param('collection') as string);
  await next();
});

app.get('/', async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');

  const schema = await server.schema.get(collectionName);
  return c.json(schema);
});

app.get('/records', async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');

  const queryParams = c.req.query();
  queryParams.expand = queryParams.expand?.split(',');

  const records = await server.records.find(collectionName, queryParams);

  return c.json(records);
});

app.get('/records/:id', async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');
  const recordId = c.req.param('id');

  // todo: add this back when we have collections
  // if (!server.records[collectionName])
  //   return c.json({ message: `collection not found: ${collectionName}` }, 404);

  const record = await server.records.get(collectionName, recordId);
  if (!record) return c.json({ message: `${collectionName} record not found: ${recordId}` }, 404);
  return c.json(record);
});

app.post(`/records`, async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');
  const record = await c.req.parseBody();

  const result = await server.records.create(collectionName, record);
  return c.json(result);
});

app.patch('/records/:id', async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');
  const id = c.req.param('id');
  const recordUpdates = await c.req.parseBody();

  const result = await server.records.update(collectionName, id, recordUpdates);
  return c.json(result);
});

app.put('/records/:id', async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');
  const id = c.req.param('id');
  const recordUpdates = await c.req.parseBody();

  const result = await server.records.upsert(collectionName, id, recordUpdates);
  return c.json(result);
});

app.delete('/records/:id', async c => {
  const server = c.get('server');
  const collectionName = c.get('collectionName');
  const id = c.req.param('id');

  const result = await server.records.delete(collectionName, id);
  return c.body(null, 204);
});
