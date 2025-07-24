import { SchemaEngine } from '../../../packages/server/lib/schemaEngine.ts';
import Server from '../../../packages/server/lib/server.ts';
import MemoryStore from '../../../packages/server/stores/InMemoryStore.ts';
import systemSchema from '../../../packages/shared/system-schema.ts';
import { serve } from '@hono/node-server';

const server = await Server.create({
  store: new MemoryStore(),
  schema: new SchemaEngine({
    ...systemSchema,
  }),
  identity: {
    url: 'http://server1.com',
    public_key: '',
  },
});

serve({ fetch: server.router.fetch, port: 5000 });
