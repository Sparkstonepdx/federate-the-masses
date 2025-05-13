import { expect, test, vi } from 'vitest';
import Server from './federated-share';
import { MemoryStore } from './store';
import { SchemaEngine } from './schema';
import systemSchema from './system-schema';
import { Schema } from './core-record-types';
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

test('p1@server1 invites p2@server2 to folder a via link', async () => {
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
    `http://server1.com${invite}`,
  );

  expect(prettyPrint(share)).toMatchInlineSnapshot(
    `"[shares:urn:shares:0@server1.com] host: "server1.com", collection: "folders", record_id: "a", server: "server1.com", access_token: "fake-jwt-token""`,
  );

  await server2.initialSync(share);

  const folder = await server2.records.get<{ title: string }>('folders', 'a');

  expect(prettyPrint(folder)).toMatchInlineSnapshot(
    `"[folders:a] host: "server1.com", name: "Folder A""`,
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
