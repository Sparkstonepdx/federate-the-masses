import { expect, test, vi } from "vitest";
import Server from "./federated-share";
import { MemoryStore } from "./store";
import { SchemaEngine } from "./schema";

let baseFields = {
  id: "string",
  created_at: "string",
  modified_at: "string",
  is_deleted: "boolean",
};

let baseSchema = {
  // used for url based invites
  invites: {
    collectionName: "invites",
    fields: {
      collection: { type: "string" },
      record: { type: "string" },
      owner: { type: "relation", collection: "users" },
      secret: { type: "string" },
    },
  },
  users: {
    collectionName: "users",
    fields: {
      name: { type: "string" },
    },
  },
  // used for tracking what is being shared between servers
  shares: {
    collectionName: "shares",
    fields: {
      collection: { type: "string" },
      record: { type: "string" },
      server: { type: "relation", collection: "servers" },
      access_token: { type: "string" },
      subcribing_server: {
        type: "relation",
        collection: "share_subscribers",
        multiple: true,
      },
    },
  },
  // remote servers subscribed to a local share or
  share_subscribers: {
    collectionName: "share_subscribers",
    fields: {
      subscribing_server: { type: "relation", collection: "servers" },
      share: { type: "relation", collection: "shares" },
    },
  },
  // remote server per pending update
  share_update_subscribers: {
    collectionName: "share_update_subscribers",
    fields: {
      subscribing_server: { type: "relation", collection: "servers" },
      share_update: { type: "relation", collection: "share_updates" },
    },
  },
  // local updates made to a share
  share_updates: {
    collectionName: "share_updates",
    fields: {
      share_id: { type: "relation", collection: "shares" },
      collection: { type: "string" },
      record: { type: "string" },
      action: { type: "string" },
      share_update_subscribers: {
        type: "relation",
        collection: "share_update_subscribers",
        multiple: true,
      },
    },
  },
  // remote servers that we are sharing with
  servers: {
    collectionName: "servers",
    fields: {
      url: { type: "string" },
      public_key: { type: "string" },
      share_update_subscribers: {
        type: "relation",
        collection: "share_update_subscribers",
        multiple: true,
      },
      share_subscribers: {
        type: "relation",
        collection: "share_subscribers",
        multiple: true,
      },
    },
  },
};

let schema = {
  ...baseSchema,
  folders: { fields: { name: { type: "string" } } },
  documents: {
    fields: {
      title: { type: "string" },
      folder: { type: "relation", collection: "folders" },
    },
  },
};

let server1Data = {
  records: {
    users: {
      p1: { id: "p1@server1.com", name: "Person 1" },
    },
    folders: {
      a: { id: "a", title: "folder A" },
    },
    documents: {},
  },
  schema,
};

let server2Data = {
  schema,
  records: {
    users: {
      p2: { id: "p2@server2.com", name: "Person 2" },
    },
    folders: {},
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

test("p1@server1 invites p2@server2 to folder a via link", async () => {
  const network = new FakeNetwork();
  const server1 = new Server({
    store: new MemoryStore(server1Data.records),
    schema: new SchemaEngine(schema),
    fetch: network.fetch,
    identity: {
      url: "http://server1.com",
      public_key: "",
    },
  });

  const server2 = new Server({
    fetch: network.fetch,
    store: new MemoryStore(server2Data.records),
    schema: new SchemaEngine(schema),
    identity: { url: "http://server2.com", public_key: "" },
  });

  network.register("http://server1.com", server1);
  network.register("http://server2.com", server2);

  vi.setSystemTime(new Date(2000, 1, 1, 13));

  const invite = await server1.createInviteLink(
    { auth: { record: { id: "p1" } } },
    "folders",
    "a",
  );
  expect(invite).toMatchInlineSnapshot(`"/api/invite/1?sec=0"`);

  let share = await server2.acceptInvite(
    { auth: { record: { id: "p2" } } },
    `http://server1.com${invite}`,
  );

  expect(share.data()).toMatchInlineSnapshot(`
    {
      "access_token": "fake-jwt-token",
      "collection": "folders",
      "created_at": "2000-02-01T21:00:00.000Z",
      "id": "2",
      "modified_at": "2000-02-01T21:00:00.000Z",
      "record_id": "a",
      "server_id": "http://server1.com",
    }
  `);

  await server2.syncShare(share, { initial: true });

  // const folder = await server2
  //   .handleRequest("/api/collections/folders/records/a")
  //   .then((r) => r.json());
  // expect(folder).toEqual({ id: "a", name: "folder A" });
});
