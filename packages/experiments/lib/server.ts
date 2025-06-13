import { Hono } from 'hono';
import apiRouter from './api';
import { Store } from './store';
import { generateId, Record, RecordEngine } from './records';
import { HooksEngine } from './hooks';
import { createDependencyTree } from './share-dag';
import { Servers, Shares } from './core-record-types';
import { SchemaEngine } from './schema';
import { attachShareUpdateTracker } from './share-update-tracker';

interface Context {
  auth: { record: { id: string } };
}

interface ConstructorOptions {
  store: Store;
  schema: SchemaEngine;
  fetch?: any;
  identity: { url: string; public_key: string };
}

export default class Server {
  public schema: SchemaEngine;
  private store: Store;
  private fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  private honoRouter: Hono;
  private identity: { url: string; public_key: string; host: string };
  public records: RecordEngine;
  private cleanupFns: Function[] = [];

  constructor(constructorOptions: ConstructorOptions) {
    const options = constructorOptions;

    const url = new URL(options.identity.url);

    this.schema = options.schema;
    this.store = options.store;
    this.fetch = options.fetch;
    this.identity = Object.assign(options.identity, { host: url.host, id: url.host });
    this.records = new RecordEngine(this.store, this.schema, this.identity.host, new HooksEngine());

    this.cleanupFns.push(attachShareUpdateTracker(this.records));

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

    await createDependencyTree(
      this.records,
      {
        collection: share.get('collection'),
        recordId: share.get('record_id'),
        relation_type: 'field',
        parent: share,
        field: 'child_id',
      },
      share.id
    );

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
    if (!response.ok) {
      throw new Error('Failed to identify server', { cause: response });
    }

    const jsonResponse = await response.json();
    server = new Record<Servers>(this.schema.get('servers'), jsonResponse);
    await this.records.create('servers', server.data());
    return server;
  }

  async acceptInvite(ctx: Context, inviteUrlString: string) {
    const remoteServer = await this.identityServer(new URL(inviteUrlString).origin);

    const response = await this.fetch(inviteUrlString);
    if (!response.ok) {
      throw new Error('failed to fetch invite details', { cause: response });
    }
    const { invite, access_token, share } = await response.json();

    return await this.records.create<Shares>('shares', {
      ...share,
      server: remoteServer.id,
      access_token,
    });
  }

  async initialSync(share: Record<Shares>) {
    await this.records.expand(share, ['server']);

    const url = new URL(`/api/share/${share.id}/sync/initial`, share.expand.server.get('url'));

    const response = await this.fetch(url, {
      method: 'post',
      body: JSON.stringify({
        subscriber: await this.getIdentity(),
      }),
    });
    if (!response.ok) {
      throw new Error(`failed to sync with server: ${share.expand.server.get('url')}`, {
        cause: response,
      });
    }

    const responseJson = await response.json();

    for (const record of responseJson.dependencies.records) {
      // record.data.server = share.expand.server.id;
      await this.records.create(record.collection, record.data);
    }

    for (const record of responseJson.records) {
      // record.data.server = share.expand.server.id;
      await this.records.create(record.collection, record.data);
    }

    await this.records.update<Shares>('shares', share.id, {
      last_remote_sync: new Date().toISOString(),
    });

    // request sync and all child records from share collection from other server;
    // save all records and link them to shareId
    //
  }

  async incrementalSync(shareId: string) {
    const share = await this.records.get<Shares>('shares', shareId);
    if (!share) throw new Error(`failed to load share: ${shareId}`);
    await this.records.expand(share, ['server']);

    console.log(share.expand.server.get('url'));

    const syncUrl = new URL(
      `/api/share/${share.id}/sync/incremental`,
      share.expand.server.get('url')
    );
    syncUrl.searchParams.set('since', share.get('last_remote_sync'));

    console.log({ syncUrl: syncUrl.toString() });

    const response = await this.fetch(syncUrl, {
      method: 'post',
      body: JSON.stringify({ subscriber: await this.getIdentity() }),
    });

    if (!response.ok) {
      throw new Error(`failed to incrementally sync: ${shareId}`, { cause: response });
    }

    const updates = await response.json();
    console.log({ updates });

    for (const update of updates.data.records) {
      console.dir(update, { depth: 10 });
      switch (update.data.action) {
        case 'update':
          await this.records.update(
            update.data.collection,
            update.data.record_id,
            update.expand.payload.data
          );
          break;
        default:
          throw new Error('not implemented');
      }
    }
  }

  async handleRequest(request: Request) {
    return await this.honoRouter.request(request);
  }

  destroy() {
    for (const fn of this.cleanupFns) {
      fn();
    }
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    server: Server;
  }
}
