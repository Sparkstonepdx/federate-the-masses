import { expect, test, vi } from 'vitest';
import Server from './federated-share';
import { MemoryStore } from './store';
import { SchemaEngine } from './schema';
import systemSchema from './system-schema';
import { Schema } from './core-record-types';

let baseFields = {
  id: 'string',
  created_at: 'string',
  modified_at: 'string',
  is_deleted: 'boolean',
};

let schema: Record<string, Schema> = {
  ...systemSchema,
  folders: { collectionName: 'folders', fields: { name: { type: 'string' } } },
  documents: {
    collectionName: 'documents',
    fields: {
      title: { type: 'string' },
      folder: { type: 'relation', collection: 'folders' },
    },
  },
};

let server1Data = {
  records: {
    users: {
      p1: { id: 'p1@server1.com', name: 'Person 1' },
    },
    folders: {
      a: { id: 'a', title: 'folder A' },
    },
    documents: {},
  },
  schema,
};

let server2Data = {
  schema,
  records: {
    users: {
      p2: { id: 'p2@server2.com', name: 'Person 2' },
    },
    folders: {},
  },
};

class FakeNetwork {
  private addresses = {};

  register(hostName: string, server: Server) {
    this.addresses[hostName] = server;
  }

  fetch = (...args: ConstructorParameters<typeof Request>) => {
    const request = new Request(...args);
    const url = new URL(request.url);

    let target = this.addresses[url.origin];

    return target.handleRequest(request);
  };
}

test('p1@server1 invites p2@server2 to folder a via link', async () => {
  const network = new FakeNetwork();

  const server1 = new Server({
    store: new MemoryStore(server1Data.records),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  const server2 = new Server({
    fetch: network.fetch,
    store: new MemoryStore(server2Data.records),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://server2.com', public_key: '' },
  });

  network.register('http://server1.com', server1);
  network.register('http://server2.com', server2);

  vi.setSystemTime(new Date(2000, 1, 1, 13));

  const invite = await server1.createInviteLink({ auth: { record: { id: 'p1' } } }, 'folders', 'a');
  expect(invite).toMatchInlineSnapshot(`"/api/invite/3?sec=2"`);

  let share = await server2.acceptInvite(
    { auth: { record: { id: 'p2' } } },
    `http://server1.com${invite}`,
  );

  expect(share.data()).toMatchInlineSnapshot(`
    {
      "access_token": "fake-jwt-token",
      "collection": undefined,
      "created_at": "2000-02-01T21:00:00.000Z",
      "id": "5",
      "modified_at": "2000-02-01T21:00:00.000Z",
      "record_id": undefined,
      "server": "http://server1.com",
    }
  `);

  await server2.syncShare(share, { initial: true });

  const folder = await server2
    .handleRequest('/api/collections/folders/records/a')
    .then(r => r.json());

  expect(folder).toEqual({ id: 'a', name: 'folder A' });
});
