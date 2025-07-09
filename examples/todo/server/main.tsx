import { SchemaEngine } from '../../../packages/experiments/lib/schema';
import Server from '../../../packages/experiments/lib/server';
import { MemoryStore } from '../../../packages/experiments/lib/store';
import systemSchema from '../../../packages/shared/system-schema';

const server = new Server({
  store: new MemoryStore(),
  schema: new SchemaEngine({
    ...systemSchema,
  }),
  identity: {
    url: 'http://server1.com',
    public_key: '',
  },
});
