import { test, expect, vi } from 'vitest';
import Server from '../../server/lib/server';
import { MemoryStore } from '../../server/lib/store';
import Client from '../../client/src/main';
import { SchemaEngine } from '../../server/lib/schema';
import { FakeNetwork } from '../lib/fakeNetwork';
import { data, schema } from '../lib/mock-data/tasks';

test('can get metadata', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  const records = await client.collection('tasks').schema();

  expect(records).toMatchInlineSnapshot(`
    {
      "collectionName": "tasks",
      "fields": {
        "child": {
          "collection": "tasks",
          "type": "relation",
          "via": "parent",
        },
        "content": {
          "required": true,
          "type": "string",
        },
        "list": {
          "collection": "lists",
          "required": true,
          "type": "relation",
        },
        "parent": {
          "collection": "tasks",
          "type": "relation",
        },
        "title": {
          "type": "string",
        },
      },
      "referencedBy": {
        "lists": true,
        "tasks": true,
      },
      "references": [
        "lists.lists",
        "lists.tasks",
        "lists.lists",
        "tasks",
        "tasks",
      ],
    }
  `);
});

test('can getFullList', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  const records = await client.collection('tasks').findAll();

  expect(records).toMatchInlineSnapshot(`
    {
      "records": [
        {
          "collection": "tasks",
          "data": {
            "content": "Create wireframes and mockups",
            "id": "task-1",
            "list": "list-1",
            "title": "Design homepage",
          },
          "id": "task-1",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Convert design into code",
            "id": "task-2",
            "list": "list-1",
            "parent": "task-1",
            "title": "Develop homepage",
          },
          "id": "task-2",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Internal QA and feedback",
            "id": "task-3",
            "list": "list-2",
            "parent": "task-2",
            "title": "Review homepage",
          },
          "id": "task-3",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Install PostgreSQL and configure",
            "id": "task-4",
            "list": "list-3",
            "title": "Setup database",
          },
          "id": "task-4",
        },
      ],
    }
  `);
});

test('can findAll with filter', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  const records = await client.collection('tasks').findAll({
    filter: `list = 'list-1'`,
    sort: '-title',
    expand: [`list`, 'parent'],
  });

  expect(records).toMatchInlineSnapshot(`
    {
      "records": [
        {
          "collection": "tasks",
          "data": {
            "content": "Convert design into code",
            "id": "task-2",
            "list": "list-1",
            "parent": "task-1",
            "title": "Develop homepage",
          },
          "expand": {
            "list": {
              "collection": "lists",
              "data": {
                "id": "list-1",
                "title": "Project Alpha",
              },
              "id": "list-1",
            },
            "parent": {
              "collection": "tasks",
              "data": {
                "content": "Create wireframes and mockups",
                "id": "task-1",
                "list": "list-1",
                "title": "Design homepage",
              },
              "id": "task-1",
            },
          },
          "id": "task-2",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Create wireframes and mockups",
            "id": "task-1",
            "list": "list-1",
            "title": "Design homepage",
          },
          "expand": {
            "list": {
              "collection": "lists",
              "data": {
                "id": "list-1",
                "title": "Project Alpha",
              },
              "id": "list-1",
            },
          },
          "id": "task-1",
        },
      ],
    }
  `);
});

test('can findAll with paging', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  const records = await client.collection('tasks').findAll({
    perPage: 2,
  });

  expect(records).toMatchInlineSnapshot(`
    {
      "records": [
        {
          "collection": "tasks",
          "data": {
            "content": "Create wireframes and mockups",
            "id": "task-1",
            "list": "list-1",
            "title": "Design homepage",
          },
          "id": "task-1",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Convert design into code",
            "id": "task-2",
            "list": "list-1",
            "parent": "task-1",
            "title": "Develop homepage",
          },
          "id": "task-2",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Internal QA and feedback",
            "id": "task-3",
            "list": "list-2",
            "parent": "task-2",
            "title": "Review homepage",
          },
          "id": "task-3",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Install PostgreSQL and configure",
            "id": "task-4",
            "list": "list-3",
            "title": "Setup database",
          },
          "id": "task-4",
        },
      ],
    }
  `);
});

test('can find with paging', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  const records = await client.collection('tasks').find({
    perPage: 2,
  });

  expect(records).toMatchInlineSnapshot(`
    {
      "page": 1,
      "perPage": "2",
      "records": [
        {
          "collection": "tasks",
          "data": {
            "content": "Create wireframes and mockups",
            "id": "task-1",
            "list": "list-1",
            "title": "Design homepage",
          },
          "id": "task-1",
        },
        {
          "collection": "tasks",
          "data": {
            "content": "Convert design into code",
            "id": "task-2",
            "list": "list-1",
            "parent": "task-1",
            "title": "Develop homepage",
          },
          "id": "task-2",
        },
      ],
    }
  `);
});

test('can findOne with paging', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  const records = await client.collection('tasks').findOne({
    page: 2,
  });

  expect(records).toMatchInlineSnapshot(`
    {
      "page": "2",
      "perPage": "1",
      "records": [
        {
          "collection": "tasks",
          "data": {
            "content": "Convert design into code",
            "id": "task-2",
            "list": "list-1",
            "parent": "task-1",
            "title": "Develop homepage",
          },
          "id": "task-2",
        },
      ],
    }
  `);
});

test('can create record', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  vi.setSystemTime(new Date(2000, 1, 1, 13));

  const records = await client.collection('tasks').create({
    content: 'A new task that was created through client api',
    title: 'A new task',
    list: 'list-1',
  });

  expect(records).toMatchInlineSnapshot(`
    {
      "collection": "tasks",
      "data": {
        "content": "A new task that was created through client api",
        "created_at": "2000-02-01T21:00:00.000Z",
        "host": "http://server1.com",
        "id": "urn:tasks:0@http://server1.com",
        "list": "list-1",
        "modified_at": "2000-02-01T21:00:00.000Z",
        "title": "A new task",
      },
      "id": "urn:tasks:0@http://server1.com",
    }
  `);
});
test('can upsert, update, and delete record', async () => {
  const network = new FakeNetwork();
  const client = new Client({ fetch: network.fetch });

  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: 'http://server1.com',
      public_key: '',
    },
  });

  network.register('http://server1.com', server);

  client.setServer('http://server1.com');

  client.initialize();

  vi.setSystemTime(new Date(2000, 1, 1, 13));
  const id = 'urn:tasks:10@http://server1.com';

  let records = await client.collection('tasks').upsert({
    content: 'A new task that was created through client api',
    title: 'A new task',
    list: 'list-1',
    id,
  });

  expect(records).toMatchInlineSnapshot(`
    {
      "collection": "tasks",
      "data": {
        "content": "A new task that was created through client api",
        "created_at": "2000-02-01T21:00:00.000Z",
        "host": "http://server1.com",
        "id": "urn:tasks:10@http://server1.com",
        "list": "list-1",
        "modified_at": "2000-02-01T21:00:00.000Z",
        "title": "A new task",
      },
      "id": "urn:tasks:10@http://server1.com",
    }
  `);

  vi.setSystemTime(new Date(2000, 1, 2, 13));

  records = await client.collection('tasks').update(id, { content: 'an update' });

  expect(records).toMatchInlineSnapshot(`
    {
      "collection": "tasks",
      "data": {
        "content": "an update",
        "created_at": "2000-02-02T21:00:00.000Z",
        "host": "http://server1.com",
        "id": "urn:tasks:10@http://server1.com",
        "list": "list-1",
        "modified_at": "2000-02-02T21:00:00.000Z",
        "title": "A new task",
      },
      "id": "urn:tasks:10@http://server1.com",
    }
  `);

  records = await client.collection('tasks').delete(id);

  expect(records).toMatchInlineSnapshot(`undefined`);
});
