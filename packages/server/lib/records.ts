import { RecordPage, Schema } from '../../shared/core-record-types';
import { HooksEngine } from './hooks';
import { SchemaEngine } from './schemaEngine';
import { FindOptions, RecordData, Store } from './store';
import { prettyPrint } from '../../shared/string';
import { generateURN } from '../../shared/urn';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export class RecordEngine {
  constructor(
    private store: Store,
    private schema: SchemaEngine,
    private serverUrl: string,
    public hooks: HooksEngine
  ) {}

  async create<RecordType extends object>(
    collectionName: string,
    data: Expand<Partial<RecordType & RecordData>>
  ) {
    const recordSchema = this.schema.get(collectionName);
    if (!recordSchema) throw new Error(`Unknown collection: ${collectionName}`);

    const now = new Date().toISOString();
    data.id ??= generateURN(collectionName, this.serverUrl);
    data.created_at ??= now;
    data.modified_at ??= data.created_at;

    const recordData = {
      host: this.serverUrl,
      ...data,
    } as RecordType & RecordData;

    await this.hooks.run('beforeCreate', collectionName, { recordData, recordSchema });
    await this.store.set(collectionName, recordData.id, recordData);
    await this.hooks.run('afterCreate', collectionName, { recordData, recordSchema });

    return new CollectionRecord<RecordType>(recordSchema, recordData);
  }

  async upsert<RecordType extends object = {}>(collectionName: string, id: string, data: object) {
    const existing = await this.store.get(collectionName, id);
    if (!existing) return this.create<RecordType>(collectionName, data);
    return this.update<RecordType>(collectionName, id, data);
  }

  async update<RecordType extends object = {}>(
    collectionName: string,
    id: string,
    data: Partial<RecordType & RecordData>
  ) {
    const recordSchema = this.schema.get(collectionName);
    if (!recordSchema) throw new Error(`Unknown collection: ${collectionName}`);

    const existing = await this.store.get(collectionName, id);

    if (!existing || existing.is_deleted) throw new Error(`Record not found: ${id}`);

    const recordData = {
      ...existing,
      ...data,
      modified_at: new Date().toISOString(),
    } as RecordType & RecordData;

    await this.hooks.run('beforeUpdate', collectionName, {
      recordData,
      recordSchema,
      previousRecordData: existing,
    });
    await this.store.set(collectionName, recordData.id, recordData);
    await this.hooks.run('afterUpdate', collectionName, {
      recordData,
      recordSchema,
      previousRecordData: existing,
    });
    return new CollectionRecord<RecordType>(recordSchema, recordData);
  }

  async delete(collectionName: string, id: string) {
    const recordData = await this.store.get(collectionName, id);
    if (!recordData || recordData.is_deleted) return;
    const recordSchema = this.schema.get(collectionName);
    if (!recordSchema) throw new Error(`Unknown collection: ${collectionName}`);

    await this.hooks.run('beforeDelete', collectionName, { recordData, recordSchema });
    await this.store.delete(collectionName, id);
    await this.hooks.run('afterDelete', collectionName, { recordData, recordSchema });

    return recordData;
  }

  async get<RecordType extends object = {}>(collectionName: string, id: string) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);
    const existing = (await this.store.get(collectionName, id)) as RecordType & RecordData;

    if (!existing) return null;

    return new CollectionRecord<RecordType>(definition, existing);
  }

  async list<RecordType extends object = {}>(collectionName: string) {
    const result = (await this.store.list(collectionName)) as RecordPage<RecordType & RecordData>;
    return {
      ...result,
      records: result.records.map(
        item => new CollectionRecord<RecordType>(this.schema.get(collectionName), item)
      ),
    };
  }

  async find<RecordType extends object = {}>(collectionName: string, options: FindOptions) {
    options.page ??= 1;
    options.perPage ??= 500;
    const result = (await this.store.find(collectionName, options)) as RecordPage<
      RecordType & RecordData
    >;
    let records = result.records.map(
      item => new CollectionRecord(this.schema.get(collectionName), item)
    );
    if (options.expand) {
      await Promise.all(records.map(record => this.expand(record, options.expand!)));
    }

    return {
      ...result,
      page: options.page,
      perPage: options.perPage,
      records,
    };
  }

  async findOne<RecordType extends object = {}>(collectionName: string, options: FindOptions) {
    const result = await this.find<RecordType>(collectionName, options);

    return result.records[0];
  }

  async expand<RecordType extends object = {}>(
    record: CollectionRecord<RecordType>,
    paths: string[],
    depth = 3
  ) {
    for (const path of paths) {
      const [fk, ...rest] = path.split('.');
      if (typeof fk !== 'string') throw new Error(`paths must be strings`);

      const fieldSchema = record.schema.fields[fk];
      if (!fieldSchema) {
        throw new Error(`field ${fk} does not exist in record: ${JSON.stringify(record, null, 2)}`);
      }

      if (fieldSchema.type !== 'relation') throw new Error('can only expand relation fields');

      let existingExpand = record?.expand?.[fk];
      let queue: (CollectionRecord<any> | null)[] = [];

      // if we've already expanded this node, lets add onto it
      if (existingExpand) {
        queue = Array.isArray(existingExpand) ? existingExpand : [existingExpand];
      } else {
        if (fieldSchema.via) {
          const page = await this.find(fieldSchema.collection, {
            filter: `${fieldSchema.via} = "${record.id}"`,
          });
          queue = page.records;
        } else {
          const fieldRecord = await this.get(
            fieldSchema.collection,
            record.get(fk as any) as string
          );
          queue = [fieldRecord];
        }

        queue = queue.filter(Boolean);
      }

      if (rest.length > 0 && depth > 0) {
        let subpath = rest.join('.');
        await Promise.all(queue.map(fieldRecord => this.expand(fieldRecord, [subpath], depth - 1)));
      }
      record.expand ??= {};
      record.expand[fk] = fieldSchema.via ? queue : queue[0];
    }
  }
}

export class CollectionRecord<RecordType extends object = {}> {
  private dirty: boolean = false;
  public expand: any;

  constructor(public schema: Schema, private _data: RecordType & RecordData) {}

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

  toJSON() {
    return {
      collection: this.collection,
      id: this.id,
      data: this.data(),
      expand: this.expand,
    };
  }

  toString() {
    return prettyPrint(this);
  }

  setExpand(e) {
    this.expand = e;
  }
}
