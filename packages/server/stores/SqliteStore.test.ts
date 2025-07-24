import { unlink } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
import Server from '../lib/server';
import SqliteStore from './SqliteStore';

afterEach(async () => {
  await unlink('./test.db');
  await unlink('./test.db-shm').catch(e => {});
  await unlink('./test.db-wal').catch(e => {});
});

test('can create new db', async () => {
  const db = new SqliteStore('./test.db');

  await db.createCollection('test', { id: { type: 'string' } });

  await db.addField('test', 'value', { type: 'string' });
  await db.addField('test', 'jsonValue', { type: 'json' });
  await db.addField('test', 'boolValue', { type: 'boolean' });
  await db.addField('test', 'datetimeValue', { type: 'datetime' });
  await db.addField('test', 'relationValue', { type: 'relation' });

  await db.close();
});

test.only('can initialize server', async () => {
  const server = await Server.create({
    store: new SqliteStore('./test.db'),
    schemas: [],
    identity: {
      url: 'http://server1.com',
    },
  });

  const migrations = await server.records.list('ftm_system_migrations');

  expect(migrations).toMatchInlineSnapshot(`
    {
      "records": [
        {
          "collection": "ftm_system_migrations",
          "data": {
            "created_at": null,
            "id": null,
            "modified_at": null,
            "version": 1,
          },
          "expand": undefined,
          "id": null,
        },
        {
          "collection": "ftm_system_migrations",
          "data": {
            "created_at": null,
            "id": null,
            "modified_at": null,
            "version": 1,
          },
          "expand": undefined,
          "id": null,
        },
      ],
    }
  `);
});
