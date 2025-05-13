import { RecordPage, Schema } from './core-record-types';
import { HooksEngine } from './hooks';
import { RecordData, Store } from './store';

let lastId = 0;

export function generateId() {
  return `${lastId++}`;
}

export class RecordEngine {
  constructor(
    private store: Store,
    private schema,
    private hooks: HooksEngine,
  ) {}

  async create<Record extends object>(collectionName: string, data: Partial<Record>) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);

    const id = generateId();
    const now = new Date().toISOString();

    const record = {
      id,
      ...data,
      created_at: now,
      modified_at: now,
    } as Record & RecordData;

    await this.hooks.run('beforeCreate', collectionName, record);
    await this.store.set(collectionName, record.id, record);
    await this.hooks.run('afterCreate', collectionName, record);

    return new Record<Record>(definition, record);
  }

  async update(collectionName: string, id: string, data: object) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);

    const existing = await this.store.get(collectionName, id);

    if (!existing || existing.is_deleted) throw new Error(`Record not found: ${id}`);

    const updated = {
      ...existing,
      ...data,
      modified_at: new Date().toISOString(),
    };

    await this.hooks.run('beforeUpdate', collectionName, updated);
    await this.store.set(collectionName, updated.id, updated);
    await this.hooks.run('afterUpdate', collectionName, updated);
    return new Record(definition, updated);
  }

  async delete(collectionName: string, id: string) {
    const existing = await this.store.get(collectionName, id);
    if (!existing || existing.is_deleted) return;

    existing.is_deleted = true;
    existing.modified_at = new Date().toISOString();

    await this.hooks.run('beforeDelete', collectionName, existing);
    await this.store.set(collectionName, id, existing);
    await this.hooks.run('afterDelete', collectionName, existing);

    return existing;
  }

  async get<RecordType extends object = {}>(collectionName: string, id: string) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);
    const existing = (await this.store.get(collectionName, id)) as RecordType & RecordData;

    if (!existing) return null;

    return new Record<RecordType>(definition, existing);
  }

  async list<RecordType extends object = {}>(collectionName: string) {
    const result = (await this.store.list(collectionName)) as RecordPage<RecordType & RecordData>;
    return {
      ...result,
      records: result.records.map(
        item => new Record<RecordType>(this.schema.get(collectionName), item),
      ),
    };
  }

  async find<RecordType extends object = {}>(collectionName: string, filter: string) {
    const result = (await this.store.find(collectionName, filter)) as RecordPage<
      RecordType & RecordData
    >;
    return {
      ...result,
      records: result.records.map(item => new Record(this.schema.get(collectionName), item)),
    };
  }

  async expand<RecordType extends object = {}>(
    record: Record<RecordType>,
    paths: string[],
    depth = 3,
  ) {
    const expansions = await Promise.all(
      paths.map(async path => {
        const [fk, ...rest] = path.split('.');
        if (typeof fk !== 'string') throw new Error(`paths must be strings`);

        const fieldSchema = record.schema.fields[fk];
        if (!fieldSchema)
          throw new Error(
            `field ${fk} does not exist in record: ${JSON.stringify(record, null, 2)}`,
          );
        const fieldRecord = await this.get(fieldSchema.collection, record.get(fk));
        if (rest.length > 0 && depth > 0) {
          await this.expand(fieldRecord, [rest.join('.')], depth - 1);
        }
        return { [fk]: fieldRecord };
      }),
    );
    record.setExpand(Object.assign(...expansions));
  }
}

export class Record<RecordType extends object = {}> {
  private dirty: boolean = false;
  public expand: any;

  constructor(
    public schema: Schema,
    private _data: RecordType & RecordData,
  ) {}

  get id() {
    if (!this._data)
      throw new Error(`tried to access data on unitialized Record: ${JSON.stringify(this)}`);
    return this._data.id;
  }

  get(key: keyof RecordType) {
    return this._data[key];
  }

  set(key: string, value: any) {
    this._data[key] = value;
    this.dirty = true;
  }

  data() {
    return this._data;
  }

  get collection() {
    return this.schema.collectionName;
  }

  setExpand(e) {
    this.expand = e;
  }
}
