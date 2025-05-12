import { HooksEngine } from "./hooks";
import { RecordData, Store } from "./store";

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

  async create<Record extends RecordData>(
    collectionName: string,
    data: Partial<Record>,
  ) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);

    const id = generateId();
    const now = new Date().toISOString();

    const record = {
      ...data,
      id,
      created_at: now,
      modified_at: now,
    } as RecordData;

    await this.hooks.run("beforeCreate", collectionName, record);
    await this.store.set(collectionName, record.id, record);
    await this.hooks.run("afterCreate", collectionName, record);

    return new Record(definition, record);
  }

  async update(collectionName: string, id: string, data: object) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);

    const existing = await this.store.get(collectionName, id);

    if (!existing || existing.is_deleted)
      throw new Error(`Record not found: ${id}`);

    const updated = {
      ...existing,
      ...data,
      modified_at: new Date().toISOString(),
    };

    await this.hooks.run("beforeUpdate", collectionName, updated);
    await this.store.set(collectionName, updated.id, updated);
    await this.hooks.run("afterUpdate", collectionName, updated);
    return new Record(definition, updated);
  }

  async delete(collectionName: string, id: string) {
    const existing = await this.store.get(collectionName, id);
    if (!existing || existing.is_deleted) return;

    existing.is_deleted = true;
    existing.modified_at = new Date().toISOString();

    await this.hooks.run("beforeDelete", collectionName, existing);
    await this.store.set(collectionName, id, existing);
    await this.hooks.run("afterDelete", collectionName, existing);

    return existing;
  }

  async get(collectionName: string, id: string) {
    const definition = this.schema.get(collectionName);
    if (!definition) throw new Error(`Unknown collection: ${collectionName}`);
    const existing = await this.store.get(collectionName, id);

    return new Record(definition, existing);
  }

  async list(collectionName: string) {
    const items = await this.store.list(collectionName);
    return items;
  }

  async expand(record: Record, paths: string[], depth = 3) {
    const expansions = await Promise.all(
      paths.map(async (path) => {
        const [fk, ...rest] = path.split(".");
        const fieldSchema = record.schema.fields[fk];
        if (!fieldSchema)
          throw new Error(
            `field ${fk} does not exist in record: ${JSON.stringify(record, null, 2)}`,
          );
        console.log({ fk, key: record.get(fk), data: record.data() });
        const fieldRecord = this.get(fieldSchema.collection, record.get(fk));
        if (rest.length > 0 && depth > 0) {
          await this.expand(fieldRecord, [rest.join(".")], depth - 1);
        }
        return { [fk]: fieldRecord };
      }),
    );
    record.setExpand(Object.assign(...expansions));
  }
}

export class Record {
  private dirty: boolean = false;
  public expand: any;

  constructor(
    public schema,
    private _data,
  ) {}

  get id() {
    {
      return this._data.id;
    }
  }

  get(key: string) {
    return this._data[key];
  }

  set(key: string, value: any) {
    this._data[key] = value;
    this.dirty = true;
  }

  data() {
    return this._data;
  }

  setExpand(e) {
    this.expand = e;
  }
}
