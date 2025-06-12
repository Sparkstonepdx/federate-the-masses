import { Hono } from 'hono';
import {
  Invites,
  Servers,
  ShareDependencies,
  Shares,
  ShareSubscribers,
  ShareUpdates,
} from './core-record-types';

const app = new Hono();
export default app;

app.get('/invite/:invite_id', async c => {
  const server = c.get('server');
  let invite = await server.records.get<Invites>('invites', c.req.param('invite_id'));

  if (!invite) return c.json({ message: 'not found' }, 404);
  if (invite.get('secret') !== c.req.query('sec')) return c.json({ message: 'unauthorized' }, 401);

  let share = await server.records.get<Shares>('shares', invite.get('share'));

  if (!share) return c.json({ message: 'internal server error' }, 500);

  return c.json({ invite: invite.data(), share: share.data(), access_token: 'fake-jwt-token' });
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

app.post('/share/:share_id/sync/initial', async c => {
  const server = c.get('server');
  const shareId = c.req.param('share_id');
  const body = await c.req.json();

  // todo: all server communication should be signed with private key so we can check it against the public key

  const subscribingServer = await server.records.upsert<Servers>(
    'servers',
    body.subscriber.id,
    body.subscriber,
  );

  let shareSubscriber = await server.records.findOne<ShareSubscribers>(
    'share_subscribers',
    `share = '${shareId}' and subscribing_server = '${subscribingServer.id}'`,
  );
  if (!shareSubscriber)
    shareSubscriber = await server.records.create<ShareSubscribers>('share_subscribers', {
      share: shareId,
      subscribing_server: subscribingServer.id,
    });

  const dependencies = await server.records.find<ShareDependencies>(
    'share_dependencies',
    `share = '${shareId}'`,
  );

  const records = await Promise.all(
    dependencies.records.map(async dep => {
      const record = await server.records.get(dep.get('child_collection'), dep.get('child_id'));
      return record;
    }),
  );

  return c.json({
    records,
    dependencies,
  });
});

app.post('/share/:share_id/sync/incremental', async c => {
  const server = c.get('server');
  const shareId = c.req.param('share_id');
  const body = await c.req.json();
  const since = c.req.query('since');

  const updates = await server.records.find<ShareUpdates>(
    `share_updates`,
    `created_at > '${since}'`,
  );

  // TODO: compress update list here so we only transfer each record once

  for (const update of updates.records) {
    const payload = await server.records.get(update.get('collection'), update.get('record_id'));
    update.setExpand({ payload });
  }

  console.log(updates);

  return c.json({ data: updates });
});
