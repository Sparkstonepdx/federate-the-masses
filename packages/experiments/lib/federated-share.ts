import { Hono } from "hono";
import { set } from "lodash-es";
import apiRouter from "./request-handler";
import { Store } from "./store";
import { generateId, RecordEngine } from "./records";
import { HooksEngine } from "./hooks";

interface Context {
  auth: { record: { id: string } };
}

interface ConstructorOptions {
  store: Store;
  schema?: any;
  fetch?: any;
  identity: { url: string; public_key: string };
}

export default class Server {
  public schema;
  private store: Store;
  private fetch;
  private honoRouter: Hono;
  private identity;
  public records: RecordEngine;

  constructor(constructorOptions: ConstructorOptions) {
    const options = constructorOptions;

    this.schema = options.schema;
    this.store = options.store;
    this.records = new RecordEngine(this.store, this.schema, new HooksEngine());

    this.fetch = options.fetch;
    this.identity = options.identity;

    const honoRouter = new Hono();
    honoRouter.use(async (c, next) => {
      c.set("server", this);
      await next();
    });

    honoRouter.route("/api", apiRouter);

    this.honoRouter = honoRouter;
  }

  async getIdentity() {
    return this.identity;
  }

  async createInviteLink(
    ctx: Context,
    collectionName: string,
    recordId: string,
  ) {
    const invite = await this.records.create("invites", {
      owner_id: ctx.auth.record.id,
      record_id: recordId,
      collection: collectionName,
      secret: generateId(),
    });

    return `/api/invite/${invite.id}?sec=${invite.get("secret")}`;
  }

  async identityServer(origin: string) {
    let server = await this.store.get("servers", origin);
    if (server) return server;
    const response = await this.fetch(origin + "/api/identity");
    console.log({ response, origin });
    if (!response.ok || response.status !== 200)
      throw new Error("Failed to identify server", { cause: response });

    server = await response.json();
    server.id = server.url;
    console.log({ server });
    await this.store.set("servers", origin, server);
    return server;
  }

  async acceptInvite(ctx: Context, inviteUrlString: string) {
    const remoteServer = await this.identityServer(
      new URL(inviteUrlString).origin,
    );

    const response = await this.fetch(inviteUrlString);
    if (!response.ok || response.status !== 200) {
      throw new Error("failed to fetch invite details", { cause: response });
    }
    const { invite, access_token } = await response.json();

    console.log({ remoteServer });

    return await this.records.create("shares", {
      server_id: remoteServer!.id,
      record_id: invite.record_id,
      collection: invite.collection,
      access_token,
    });
  }

  async syncShare(share, opts?: { initial?: boolean }) {
    console.log({ share });
    await this.records.expand(share, ["server"]);
    console.dir(share, { depth: 10 });

    // request sync and all child records from share collection from other server;
    // save all records and link them to shareId
    //
  }

  async handleRequest(request) {
    console.log("handleRequest");
    console.log(request.url);
    return await this.honoRouter.request(request);
  }
}

declare module "hono" {
  interface ContextVariableMap {
    server: Server;
  }
}
