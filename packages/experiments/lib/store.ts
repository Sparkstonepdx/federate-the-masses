export interface RecordData {
  id: string;
  is_deleted?: boolean;
  modified_at: string;
  created_at: string;
}

export interface Store {
  get(collectionName: string, id: string): Promise<RecordData | undefined>;
  set(collectionName: string, id: string, value: RecordData): Promise<void>;
  list(CollectionName: string): Promise<RecordData[]>;
  delete(collectionName: string, id: string): Promise<void>;
}

export class MemoryStore implements Store {
  public db = new Map<string, Map<string, RecordData>>();

  constructor(initialData?: object) {
    if (initialData) {
      for (const [collectionName, records] of Object.entries(
        initialData ?? {},
      )) {
        const recordMap = new Map();
        for (const [id, record] of Object.entries(records ?? {})) {
          recordMap.set(id, record);
        }

        this.db.set(collectionName, recordMap);
      }
    }
  }

  get(collection: string, id: string) {
    return Promise.resolve(this.db.get(collection)?.get(id));
  }

  set(collection: string, id: string, value: RecordData) {
    if (!this.db.has(collection)) this.db.set(collection, new Map());
    this.db.get(collection)!.set(id, value);
    return Promise.resolve();
  }

  list(collection: string) {
    return Promise.resolve(Array.from(this.db.get(collection)?.values() ?? []));
  }

  delete(collection: string, id: string) {
    this.db.get(collection)?.delete(id);
    return Promise.resolve();
  }
}
