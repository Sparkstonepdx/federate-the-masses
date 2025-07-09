import { SchemaEngine } from "../../../packages/experiments/lib/schema.ts";
import Server from "../../../packages/experiments/lib/server.ts";
import { MemoryStore } from "../../../packages/experiments/lib/store.ts";
import systemSchema from "../../../packages/experiments/lib/system-schema.ts";
import { serve } from "@hono/node-server";

const server = new Server({
  store: new MemoryStore(),
  schema: new SchemaEngine({
    ...systemSchema,
  }),
  identity: {
    url: "http://server1.com",
    public_key: "",
  },
});

serve({ fetch: server.router.fetch, port: 5000 });
