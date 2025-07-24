import { Hono } from 'hono';
import { Schema, SchemaField, Servers, Shares } from '../../shared/core-record-types';
import { Fetch } from '../../shared/types';
import { generateId } from '../../shared/urn';
import apiRouter from './api';
import { HooksEngine } from './hooks';
import { CollectionRecord, RecordEngine } from './records';
import { SchemaEngine } from './schemaEngine';
import { FtmSystemKV, FtmSystemMigrations } from './schemas/system';
import { createDependencyTree } from './share-dag';
import { Store } from './store';

interface Context {
  auth: { record: { id: string } };
}

type MigrationContext = any;

interface Migration {
  version: number;
  description?: string;
  addFields?: Record<string, SchemaField>;
  removeFields?: string[];
  up?(ctx: MigrationContext): Promise<void>;
}

declare module 'hono' {
  interface ContextVariableMap {
    server: Server;
  }
}

interface ServerPlugin {
  name: string;
  setup(server: Server): void;
}

export interface MigratableSchema {
  collectionName: string;
  untrackSharing?: boolean;
  migrations: Migration[];
}

interface ConstructorOptions {
  store: Store;
  schemas: MigratableSchema[];
  fetch?: any;
  identity: { url: string; public_key: string };
  plugins?: ServerPlugin[];
}

export default class Server {
  public schema: SchemaEngine;
  private store: Store;
  private fetch: Fetch;
  private honoRouter: Hono;
  private identity: { url: string; public_key: string; host: string };
  public records: RecordEngine;
  private cleanupFns: Function[] = [];

  private constructor(options: ConstructorOptions) {
    const url = new URL(options.identity.url);

    // this.schema = new SchemaEngine(options.schemas);
    this.store = options.store;
    this.fetch = options.fetch;
    this.identity = Object.assign(options.identity, { host: url.host, id: url.host });
  }

  static async create(constructorOptions: ConstructorOptions) {
    const server = new Server(constructorOptions);
    await server.setupSchema(constructorOptions);
    await server.setupPlugins(constructorOptions);
    await server.attachRouter(constructorOptions);

    return server;
  }

  private async setupSchema(options: ConstructorOptions) {
    const systemMigrations = await this.store.list('ftm_system_migrations').catch(() => ({
      records: [],
    }));

    const migrations = Object.fromEntries(
      systemMigrations.records.map(record => [record.id, record])
    );

    const schemas = [FtmSystemMigrations, FtmSystemKV];

    for (const plugin of options.plugins ?? []) {
      if (plugin.schemas) {
        schemas.push(...plugin.schemas);
      }
    }

    schemas.push(...(options.schemas ?? []));

    for (const schema of schemas) {
      if (!migrations[schema.collectionName]) {
        await this.store.createCollection(schema.collectionName, {
          id: { type: 'string' },
          modified_at: { type: 'datetime' },
          created_at: { type: 'datetime' },
        });
        migrations[schema.collectionName] = { version: 0 };
      }
      for (let i = migrations[schema.collectionName].version; i < schema.migrations.length; i++) {
        const migration = schema.migrations[i];
        if (migration.removeFields) {
          await this.store.removeFields(schema.collectionName, migration.removeFields);
        }
        await this.store.addFields(schema.collectionName, migration.addFields);
      }
      await this.store.set('ftm_system_migrations', schema.collectionName, {
        version: schema.migrations.length,
      });
    }

    // this.schema = options.schema ?? {
    //   get(field: string) {
    //     return this[field];
    //   },
    // };

    const schemaLookup = {};

    for (const schema of schemas) {
      schema.fields ??= {};
      for (const migration of schema.migrations) {
        for (const field of migration.removeFields ?? []) {
          delete schema.fields[field];
        }
        for (const [fieldName, field] of Object.entries(migration.addFields ?? {})) {
          schema.fields[fieldName] = field;
        }
      }
      schemaLookup[schema.collectionName] = schema;
    }

    // this.schema = new SchemaEngine(schemaLookup);

    this.schema = Object.assign(schemaLookup, {
      get(field: string) {
        return this[field];
      },
    });

    this.records = new RecordEngine(this.store, this.schema, this.identity.host, new HooksEngine());
  }

  private async setupPlugins(options: ConstructorOptions) {
    for (const plugin of options.plugins ?? []) {
      plugin.setup(this);
    }
  }

  private async attachRouter(options: ConstructorOptions) {
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
    server = new CollectionRecord<Servers>(this.schema.get('servers'), jsonResponse);
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

  async initialSync(share: CollectionRecord<Shares>) {
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

    const syncUrl = new URL(
      `/api/share/${share.id}/sync/incremental`,
      share.expand.server.get('url')
    );
    syncUrl.searchParams.set('since', share.get('last_remote_sync'));

    const response = await this.fetch(syncUrl, {
      method: 'post',
      body: JSON.stringify({ subscriber: await this.getIdentity() }),
    });

    if (!response.ok) {
      throw new Error(`failed to incrementally sync: ${shareId}`, { cause: response });
    }

    const updates = await response.json();

    for (const update of updates.data.records) {
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

  get router() {
    return this.honoRouter;
  }

  async handleRequest(request: Request) {
    return await this.honoRouter.request(request);
  }

  destroy() {
    for (const fn of this.cleanupFns) {
      fn();
    }
  }

  onDestroy(callback: Function) {
    this.cleanupFns.push(callback);
  }
}
