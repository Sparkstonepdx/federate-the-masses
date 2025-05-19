import { expect, test, vi } from 'vitest';
import { RecordEngine } from './records';
import { SchemaEngine } from './schema';
import { HooksEngine } from './hooks';
import { attachShareUpdateTracker, findRelatedRecords } from './share-update-tracker';
import { MemoryStore } from './store';
import systemSchema from './system-schema';
import { Schema } from './core-record-types';
import { prettyList, prettyPrint } from './string';

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

test('when creating a shared record, update the relevant records', async () => {
  vi.setSystemTime(new Date(2000, 1, 1, 13));
  const records = new RecordEngine(
    new MemoryStore(currentState),
    new SchemaEngine(schema),
    'test-url.com',
    new HooksEngine(),
  );

  attachShareUpdateTracker(records);

  vi.setSystemTime(new Date(2000, 1, 2, 13));

  const document = await records.create<{ folder: string; title: string }>('documents', {
    folder: 'b',
    title: 'new doc in folder b',
  });

  vi.setSystemTime(new Date(2000, 1, 3, 13));

  expect(await findRelatedRecords(records, document)).toMatchInlineSnapshot(
    `
    [
      {
        "field": "folder",
        "record": {
          "collection": "folders",
          "data": {
            "host": "server1.com",
            "id": "b",
            "name": "Folder B",
            "parent": "a",
          },
          "expand": undefined,
          "id": "b",
        },
        "relation_type": "field",
      },
    ]
  `,
  );

  expect(await prettyList(records.list('share_updates'), ['record_id', 'action']))
    .toMatchInlineSnapshot(`
      {
        "records": [
          "[share_updates:urn:share_updates:2@test-url.com] record_id: "urn:documents:0@test-url.com", action: "create"",
        ],
      }
    `);

  expect(await prettyList(records.list('share_dependencies'))).toMatchInlineSnapshot(`
    {
      "records": [
        "[share_dependencies:urn:share_dependencies:1@server1.com] child_collection: "folders", child_id: "a", field: "child_id", host: "server1.com", parent_collection: "shares", parent_id: "urn:shares:0@server1.com", relation_type: "field", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:2@server1.com] child_collection: "folders", child_id: "b", field: "parent", host: "server1.com", parent_collection: "folders", parent_id: "a", relation_type: "via", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:3@server1.com] child_collection: "folders", child_id: "c", field: "parent", host: "server1.com", parent_collection: "folders", parent_id: "a", relation_type: "via", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:4@server1.com] child_collection: "documents", child_id: "doc-1", field: "folder", host: "server1.com", parent_collection: "folders", parent_id: "a", relation_type: "via", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:5@server1.com] child_collection: "folders", child_id: "d", field: "parent", host: "server1.com", parent_collection: "folders", parent_id: "b", relation_type: "via", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:6@server1.com] child_collection: "documents", child_id: "doc-2", field: "folder", host: "server1.com", parent_collection: "folders", parent_id: "b", relation_type: "via", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:7@server1.com] child_collection: "documents", child_id: "doc-3", field: "folder", host: "server1.com", parent_collection: "folders", parent_id: "d", relation_type: "via", share: "urn:shares:0@server1.com"",
        "[share_dependencies:urn:share_dependencies:1@test-url.com] host: "test-url.com", share: "urn:shares:0@server1.com", parent_collection: "folders", parent_id: "b", child_collection: "documents", child_id: "urn:documents:0@test-url.com"",
      ],
    }
  `);
});

test('when deleting a shared record, update the relevant records', async () => {
  vi.setSystemTime(new Date(2000, 1, 1, 13));
  const records = new RecordEngine(
    new MemoryStore(currentState),
    new SchemaEngine(schema),
    'test-url.com',
    new HooksEngine(),
  );

  attachShareUpdateTracker(records);
  vi.setSystemTime(new Date(2000, 1, 2, 13));

  await records.delete('documents', 'doc-2');

  expect(
    await prettyList(
      records.find('share_updates', `created_at > '${new Date(2000, 1, 2, 12).toISOString()}'`),
      ['share', 'record_id', 'action'],
    ),
  ).toMatchInlineSnapshot(`
    {
      "records": [
        "[share_updates:urn:share_updates:3@test-url.com] share: "urn:shares:0@server1.com", record_id: "doc-2", action: "delete"",
      ],
    }
  `);

  expect(await prettyList(records.list('share_dependencies'), ['share', 'parent_id', 'child_id']))
    .toMatchInlineSnapshot(`
      {
        "records": [
          "[share_dependencies:urn:share_dependencies:1@server1.com] share: "urn:shares:0@server1.com", parent_id: "urn:shares:0@server1.com", child_id: "a"",
          "[share_dependencies:urn:share_dependencies:2@server1.com] share: "urn:shares:0@server1.com", parent_id: "a", child_id: "b"",
          "[share_dependencies:urn:share_dependencies:3@server1.com] share: "urn:shares:0@server1.com", parent_id: "a", child_id: "c"",
          "[share_dependencies:urn:share_dependencies:4@server1.com] share: "urn:shares:0@server1.com", parent_id: "a", child_id: "doc-1"",
          "[share_dependencies:urn:share_dependencies:5@server1.com] share: "urn:shares:0@server1.com", parent_id: "b", child_id: "d"",
          "[share_dependencies:urn:share_dependencies:7@server1.com] share: "urn:shares:0@server1.com", parent_id: "d", child_id: "doc-3"",
        ],
      }
    `);

  vi.setSystemTime(new Date(2000, 1, 3, 12));

  await records.delete('folders', 'b');

  expect(
    await prettyList(
      records.find('share_updates', `created_at > '${new Date(2000, 1, 2, 13).toISOString()}'`),
      ['record_id', 'action'],
    ),
  ).toMatchInlineSnapshot(`
    {
      "records": [
        "[share_updates:urn:share_updates:4@test-url.com] record_id: "b", action: "delete"",
        "[share_updates:urn:share_updates:5@test-url.com] record_id: "d", action: "delete"",
        "[share_updates:urn:share_updates:6@test-url.com] record_id: "doc-3", action: "delete"",
      ],
    }
  `);
  expect(await prettyList(records.list('share_dependencies'), ['parent_id', 'child_id']))
    .toMatchInlineSnapshot(`
      {
        "records": [
          "[share_dependencies:urn:share_dependencies:1@server1.com] parent_id: "urn:shares:0@server1.com", child_id: "a"",
          "[share_dependencies:urn:share_dependencies:3@server1.com] parent_id: "a", child_id: "c"",
          "[share_dependencies:urn:share_dependencies:4@server1.com] parent_id: "a", child_id: "doc-1"",
        ],
      }
    `);
});

test('update a record that is currently shared', async () => {
  vi.setSystemTime(new Date(2000, 1, 1, 13));
  const records = new RecordEngine(
    new MemoryStore(currentState),
    new SchemaEngine(schema),
    'test-url.com',
    new HooksEngine(),
  );

  attachShareUpdateTracker(records);
  vi.setSystemTime(new Date(2000, 1, 2, 13));

  expect(await prettyList(records.list('folders'))).toMatchInlineSnapshot(`
    {
      "records": [
        "[folders:a] host: "server1.com", name: "Folder A"",
        "[folders:b] host: "server1.com", name: "Folder B", parent: "a"",
        "[folders:c] host: "server1.com", name: "Folder C", parent: "a"",
        "[folders:d] host: "server1.com", name: "Folder D", parent: "b"",
      ],
    }
  `);

  await records.update('folders', 'b', { parent: undefined });

  expect(await prettyList(records.list('share_updates'), ['share', 'action', 'record_id']))
    .toMatchInlineSnapshot(`
      {
        "records": [
          "[share_updates:urn:share_updates:7@test-url.com] share: "urn:shares:0@server1.com", action: "delete", record_id: "b"",
          "[share_updates:urn:share_updates:8@test-url.com] share: "urn:shares:0@server1.com", action: "delete", record_id: "d"",
          "[share_updates:urn:share_updates:9@test-url.com] share: "urn:shares:0@server1.com", action: "delete", record_id: "doc-2"",
          "[share_updates:urn:share_updates:10@test-url.com] share: "urn:shares:0@server1.com", action: "delete", record_id: "doc-3"",
        ],
      }
    `);
  expect(await prettyList(records.list('share_dependencies'), ['parent_id', 'child_id']))
    .toMatchInlineSnapshot(`
    {
      "records": [
        "[share_dependencies:urn:share_dependencies:1@server1.com] parent_id: "urn:shares:0@server1.com", child_id: "a"",
        "[share_dependencies:urn:share_dependencies:3@server1.com] parent_id: "a", child_id: "c"",
        "[share_dependencies:urn:share_dependencies:4@server1.com] parent_id: "a", child_id: "doc-1"",
      ],
    }
  `);

  vi.setSystemTime(new Date(2000, 1, 3, 13));

  await records.update('folders', 'b', { parent: 'c' });

  expect(
    await prettyList(
      records.find('share_updates', `created_at > '${new Date(2000, 1, 3, 12).toISOString()}'`),
      ['share', 'action', 'record_id'],
    ),
  ).toMatchInlineSnapshot(`
    {
      "records": [
        "[share_updates:urn:share_updates:12@test-url.com] share: "urn:shares:0@server1.com", action: "create", record_id: "b"",
        "[share_updates:urn:share_updates:14@test-url.com] share: "urn:shares:0@server1.com", action: "create", record_id: "d"",
        "[share_updates:urn:share_updates:16@test-url.com] share: "urn:shares:0@server1.com", action: "create", record_id: "doc-2"",
        "[share_updates:urn:share_updates:18@test-url.com] share: "urn:shares:0@server1.com", action: "create", record_id: "doc-3"",
      ],
    }
  `);

  expect(await prettyList(records.list('share_dependencies'), ['parent_id', 'child_id']))
    .toMatchInlineSnapshot(`
      {
        "records": [
          "[share_dependencies:urn:share_dependencies:1@server1.com] parent_id: "urn:shares:0@server1.com", child_id: "a"",
          "[share_dependencies:urn:share_dependencies:3@server1.com] parent_id: "a", child_id: "c"",
          "[share_dependencies:urn:share_dependencies:4@server1.com] parent_id: "a", child_id: "doc-1"",
          "[share_dependencies:urn:share_dependencies:11@test-url.com] parent_id: "c", child_id: "b"",
          "[share_dependencies:urn:share_dependencies:13@test-url.com] parent_id: "b", child_id: "d"",
          "[share_dependencies:urn:share_dependencies:15@test-url.com] parent_id: "b", child_id: "doc-2"",
          "[share_dependencies:urn:share_dependencies:17@test-url.com] parent_id: "d", child_id: "doc-3"",
        ],
      }
    `);
});

const currentState = {
  documents: {
    'doc-1': {
      folder: 'a',
      host: 'server1.com',
      id: 'doc-1',
      title: 'Spec Sheet',
    },
    'doc-2': {
      folder: 'b',
      host: 'server1.com',
      id: 'doc-2',
      title: 'Design Doc',
    },
    'doc-3': {
      folder: 'd',
      host: 'server1.com',
      id: 'doc-3',
      title: 'Notes',
    },
  },
  folders: {
    a: {
      host: 'server1.com',
      id: 'a',
      name: 'Folder A',
    },
    b: {
      host: 'server1.com',
      id: 'b',
      name: 'Folder B',
      parent: 'a',
    },
    c: {
      host: 'server1.com',
      id: 'c',
      name: 'Folder C',
      parent: 'a',
    },
    d: {
      host: 'server1.com',
      id: 'd',
      name: 'Folder D',
      parent: 'b',
    },
  },
  invites: {
    'urn:invites:9@server1.com': {
      created_at: '2000-02-01T21:00:00.000Z',
      host: 'server1.com',
      id: 'urn:invites:9@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      owner_id: 'p1',
      secret: '8',
      share: 'urn:shares:0@server1.com',
    },
  },
  servers: {
    'server2.com': {
      created_at: '2000-02-01T21:00:00.000Z',
      host: 'server2.com',
      id: 'server2.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      public_key: '',
      url: 'http://server2.com',
    },
  },
  share_dependencies: {
    'urn:share_dependencies:1@server1.com': {
      child_collection: 'folders',
      child_id: 'a',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'child_id',
      host: 'server1.com',
      id: 'urn:share_dependencies:1@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'shares',
      parent_id: 'urn:shares:0@server1.com',
      relation_type: 'field',
      share: 'urn:shares:0@server1.com',
    },
    'urn:share_dependencies:2@server1.com': {
      child_collection: 'folders',
      child_id: 'b',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'parent',
      host: 'server1.com',
      id: 'urn:share_dependencies:2@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'folders',
      parent_id: 'a',
      relation_type: 'via',
      share: 'urn:shares:0@server1.com',
    },
    'urn:share_dependencies:3@server1.com': {
      child_collection: 'folders',
      child_id: 'c',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'parent',
      host: 'server1.com',
      id: 'urn:share_dependencies:3@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'folders',
      parent_id: 'a',
      relation_type: 'via',
      share: 'urn:shares:0@server1.com',
    },
    'urn:share_dependencies:4@server1.com': {
      child_collection: 'documents',
      child_id: 'doc-1',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'folder',
      host: 'server1.com',
      id: 'urn:share_dependencies:4@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'folders',
      parent_id: 'a',
      relation_type: 'via',
      share: 'urn:shares:0@server1.com',
    },
    'urn:share_dependencies:5@server1.com': {
      child_collection: 'folders',
      child_id: 'd',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'parent',
      host: 'server1.com',
      id: 'urn:share_dependencies:5@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'folders',
      parent_id: 'b',
      relation_type: 'via',
      share: 'urn:shares:0@server1.com',
    },
    'urn:share_dependencies:6@server1.com': {
      child_collection: 'documents',
      child_id: 'doc-2',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'folder',
      host: 'server1.com',
      id: 'urn:share_dependencies:6@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'folders',
      parent_id: 'b',
      relation_type: 'via',
      share: 'urn:shares:0@server1.com',
    },
    'urn:share_dependencies:7@server1.com': {
      child_collection: 'documents',
      child_id: 'doc-3',
      created_at: '2000-02-01T21:00:00.000Z',
      field: 'folder',
      host: 'server1.com',
      id: 'urn:share_dependencies:7@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      parent_collection: 'folders',
      parent_id: 'd',
      relation_type: 'via',
      share: 'urn:shares:0@server1.com',
    },
  },
  share_subscribers: {
    'urn:share_subscribers:13@server1.com': {
      created_at: '2000-02-01T21:00:00.000Z',
      host: 'server1.com',
      id: 'urn:share_subscribers:13@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      share: 'urn:shares:0@server1.com',
      subscribing_server: 'server2.com',
    },
  },
  shares: {
    'urn:shares:0@server1.com': {
      collection: 'folders',
      created_at: '2000-02-01T21:00:00.000Z',
      host: 'server1.com',
      id: 'urn:shares:0@server1.com',
      modified_at: '2000-02-01T21:00:00.000Z',
      record_id: 'a',
    },
  },
  users: {
    p1: {
      id: 'p1@server1.com',
      name: 'Person 1',
    },
  },
};
