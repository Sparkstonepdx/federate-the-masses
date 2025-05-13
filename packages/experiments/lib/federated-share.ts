import { Hono } from 'hono';
import { set } from 'lodash-es';
import apiRouter from './request-handler';
import { Store } from './store';
import { generateId, Record, RecordEngine } from './records';
import { HooksEngine } from './hooks';
import { buildShareGraph } from './share-dag';
import { Servers, Shares } from './core-record-types';
import { SchemaEngine } from './schema';

interface Context {
  auth: { record: { id: string } };
}

interface ConstructorOptions {
  store: Store;
  schema?: SchemaEngine;
  fetch?: any;
  identity: { url: string; public_key: string };
}

export default class Server {
  public schema;
  private store: Store;
  private fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
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
      c.set('server', this);
      await next();
    });

    honoRouter.route('/api', apiRouter);

    this.honoRouter = honoRouter;
  }

  async getIdentity() {
    return this.identity;
  }

  async createInviteLink(ctx: Context, collectionName: string, recordId: string) {
    const share = await this.records.create<Shares>('shares', {
      collection: collectionName,
      record_id: recordId,
    });

    await buildShareGraph(this, share);

    const invite = await this.records.create('invites', {
      owner_id: ctx.auth.record.id,
      share: share.id,
      secret: generateId(),
    });

    return `/api/invite/${invite.id}?sec=${invite.get('secret')}`;
  }

  async identityServer(origin: string) {
    let server = await this.records.get<Servers>('servers', origin);
    if (server) return server;
    const response = await this.fetch(origin + '/api/identity');
    if (!response.ok || response.status !== 200)
      throw new Error('Failed to identify server', { cause: response });

    const jsonResponse = await response.json();
    server = new Record<Servers>(this.schema.get('servers'), jsonResponse);
    server.set('id', server.get('url'));
    await this.records.create('servers', server.data());
    return server;
  }

  async acceptInvite(ctx: Context, inviteUrlString: string) {
    const remoteServer = await this.identityServer(new URL(inviteUrlString).origin);
    console.log({ remoteServer });

    const response = await this.fetch(inviteUrlString);
    if (!response.ok || response.status !== 200) {
      throw new Error('failed to fetch invite details', { cause: response });
    }
    const { invite, access_token } = await response.json();

    return await this.records.create('shares', {
      server: remoteServer!.id,
      record_id: invite.record_id,
      collection: invite.collection,
      access_token,
    });
  }

  async syncShare(share, opts?: { initial?: boolean }) {
    await this.records.expand(share, ['server']);

    console.log(share);

    console.log({ server: share.expand.server });

    // request sync and all child records from share collection from other server;
    // save all records and link them to shareId
    //
  }

  async handleRequest(request) {
    return await this.honoRouter.request(request);
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    server: Server;
  }
}
