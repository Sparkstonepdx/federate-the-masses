import { expect, test, vi } from 'vitest';
import Server from './server';
import { MemoryStore } from './store';
import { SchemaEngine } from './schema';
import systemSchema from './system-schema';
import { Schema, Shares } from './core-record-types';
import { prettyPrint, prettyPrintArray } from './string';

let baseFields = {
  id: 'string',
  created_at: 'string',
  modified_at: 'string',
  is_deleted: 'boolean',
};

let schema: Record<string, Schema> = {
  ...systemSchema,
  folders: {
    collectionName: 'folders',
    fields: {
      name: { type: 'string' },
      parent: { type: 'relation', collection: 'folders' },
      child_folders: { type: 'relation', collection: 'folders', via: 'parent' },
      child_files: { type: 'relation', collection: 'documents', via: 'folder' },
    },
  },
  documents: {
    collectionName: 'documents',
    fields: {
      title: { type: 'string' },
      folder: { type: 'relation', collection: 'folders' },
    },
  },
};

/*
Folder A (a)
├── doc-1: "Spec Sheet"
├── Folder B (b)
│   ├── doc-2: "Design Doc"
│   └── Folder D (d)
│       └── doc-3: "Notes"
└── Folder C (c)
*/

let server1Data = {
  users: {
    p1: { id: 'p1@server1.com', name: 'Person 1' },
  },
  folders: {
    a: { id: 'a', host: 'server1.com', name: 'Folder A' }, // root folder
    b: { id: 'b', host: 'server1.com', name: 'Folder B', parent: 'a' }, // child of A
    c: { id: 'c', host: 'server1.com', name: 'Folder C', parent: 'a' }, // child of A
    d: { id: 'd', host: 'server1.com', name: 'Folder D', parent: 'b' }, // child of B
  },
  documents: {
    'doc-1': { id: 'doc-1', host: 'server1.com', title: 'Spec Sheet', folder: 'a' },
    'doc-2': { id: 'doc-2', host: 'server1.com', title: 'Design Doc', folder: 'b' },
    'doc-3': { id: 'doc-3', host: 'server1.com', title: 'Notes', folder: 'd' },
  },
};

/*
Folder X (x)
├── doc-4: "Invoice"
└── Folder Y (y)
    └── doc-5: "Summary"
*/

let server2Data = {
  users: {
    p2: { id: 'p2@server2.com', name: 'Person 2' },
  },
  folders: {
    x: { id: 'x', name: 'Folder X' },
    y: { id: 'y', name: 'Folder Y', parent: 'x' },
  },
  documents: {
    'doc-4': { id: 'doc-4', title: 'Invoice', folder: 'x' },
    'doc-5': { id: 'doc-5', title: 'Summary', folder: 'y' },
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

test('can share and accept invite', async () => {
  const network = new FakeNetwork();

  const server1 = new Server({
    store: new MemoryStore(server1Data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  const server2 = new Server({
    fetch: network.fetch,
    store: new MemoryStore(server2Data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://server2.com', public_key: '' },
  });

  network.register('http://server1.com', server1);
  network.register('http://server2.com', server2);

  vi.setSystemTime(new Date(2000, 1, 1, 13));

  const invite = await server1.createInviteLink({ auth: { record: { id: 'p1' } } }, 'folders', 'a');
  expect(invite).toMatchInlineSnapshot(`"/api/invite/urn:invites:9@server1.com?sec=8"`);

  let share = await server2.acceptInvite(
    { auth: { record: { id: 'p2' } } },
    `http://server1.com${invite}`
  );

  expect(prettyPrint(share)).toMatchInlineSnapshot(
    `"[shares:urn:shares:0@server1.com] host: "server1.com", collection: "folders", record_id: "a", server: "server1.com", access_token: "fake-jwt-token""`
  );
});

test('can invite and complete initial sync', async () => {
  // node setup
  const network = new FakeNetwork();

  const server1 = new Server({
    store: new MemoryStore(server1Data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  const server2 = new Server({
    fetch: network.fetch,
    store: new MemoryStore(server2Data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://server2.com', public_key: '' },
  });

  network.register('http://server1.com', server1);
  network.register('http://server2.com', server2);

  vi.setSystemTime(new Date(2000, 1, 1, 13));

  const invite = await server1.createInviteLink({ auth: { record: { id: 'p1' } } }, 'folders', 'a');

  let share = await server2.acceptInvite(
    { auth: { record: { id: 'p2' } } },
    `http://server1.com${invite}`
  );

  await server2.initialSync(share);

  const updatedShare = await server2.records.get<Shares>('shares', share.id);

  expect(updatedShare!.get('last_remote_sync')).toMatchInlineSnapshot(`"2000-02-01T21:00:00.000Z"`);

  const folder = await server2.records.get<{ title: string }>('folders', 'a');

  expect(prettyPrint(folder)).toMatchInlineSnapshot(
    `"[folders:a] host: "server1.com", name: "Folder A""`
  );

  const documents = await server2.records.list('documents');
  expect(prettyPrintArray(documents.records)).toMatchInlineSnapshot(`
    "[documents:doc-4] title: "Invoice", folder: "x"
    [documents:doc-5] title: "Summary", folder: "y"
    [documents:doc-1] host: "server1.com", title: "Spec Sheet", folder: "a"
    [documents:doc-2] host: "server1.com", title: "Design Doc", folder: "b"
    [documents:doc-3] host: "server1.com", title: "Notes", folder: "d""
  `);
});

test.only('can complete incremental sync from host after initial sync', async () => {
  // node setup
  const network = new FakeNetwork();
  const server1Store = new MemoryStore(server1Data);

  const server1 = new Server({
    store: server1Store,
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  const server2 = new Server({
    fetch: network.fetch,
    store: new MemoryStore(server2Data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://server2.com', public_key: '' },
  });

  network.register('http://server1.com', server1);
  network.register('http://server2.com', server2);

  vi.setSystemTime(new Date(2000, 1, 1, 13));

  const invite = await server1.createInviteLink({ auth: { record: { id: 'p1' } } }, 'folders', 'a');

  let share = await server2.acceptInvite(
    { auth: { record: { id: 'p2' } } },
    `http://server1.com${invite}`
  );

  await server2.initialSync(share);

  const folder = await server2.records.get<{ title: string }>('folders', 'a');

  expect(prettyPrint(folder)).toMatchInlineSnapshot(
    `"[folders:a] host: "server1.com", name: "Folder A""`
  );

  const documents = await server2.records.list('documents');
  expect(prettyPrintArray(documents.records)).toMatchInlineSnapshot(`
    "[documents:doc-4] title: "Invoice", folder: "x"
    [documents:doc-5] title: "Summary", folder: "y"
    [documents:doc-1] host: "server1.com", title: "Spec Sheet", folder: "a"
    [documents:doc-2] host: "server1.com", title: "Design Doc", folder: "b"
    [documents:doc-3] host: "server1.com", title: "Notes", folder: "d""
  `);

  vi.setSystemTime(new Date(2000, 1, 2, 13));

  await server1.records.update('documents', 'doc-1', { title: 'an updated title' });

  await server2.incrementalSync(share.id);
  const doc1 = await server2.records.get('documents', 'doc-1');

  expect(prettyPrint(doc1)).toMatchInlineSnapshot(
    `"[documents:doc-1] host: "server1.com", title: "an updated title", folder: "a""`
  );
});
