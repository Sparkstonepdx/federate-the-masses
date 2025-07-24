import { SchemaEngine } from '../../../packages/server/lib/schemaEngine';
import Server from '../../../packages/server/lib/server';
import MemoryStore from '../../../packages/server/stores/InMemoryStore';
import systemSchema from '../../../packages/shared/system-schema';

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
