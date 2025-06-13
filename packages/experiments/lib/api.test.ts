import { test, vi } from 'vitest';
import { data, schema } from './mock-data/tasks';
import Server from './server';
import { MemoryStore } from './store';
import { SchemaEngine } from './schema';

test('incremental sync updates', async () => {
  // const server = new Server({
  //   store: new MemoryStore(data),
  //   schema: new SchemaEngine(schema),
  //   identity: { url: 'http://test-server.com', public_key: 'asdf' },
  // });
  // vi.setSystemTime(new Date(2020, 1, 1));
  // server.createInviteLink
  // server.handleRequest;
});
