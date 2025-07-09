import { RecordPage } from '../../shared/core-record-types';
import { evaluateFilter } from './sql-filter';

export interface RecordData {
  id: string;
  is_deleted?: boolean;
  modified_at: string;
  created_at: string;
  host: string;
}

export interface Store {
  get<Record>(collectionName: string, id: string): Promise<(Record & RecordData) | undefined>;
  set(collectionName: string, id: string, value: RecordData): Promise<void>;
  list<Record>(CollectionName: string): Promise<RecordPage<Record & RecordData>>;
  find<Record>(collectionName: string, filter: string): Promise<RecordPage<Record & RecordData>>;
  delete(collectionName: string, id: string): Promise<void>;
}

export class MemoryStore implements Store {
  public db = new Map<string, Map<string, RecordData>>();

  constructor(initialData?: object) {
    if (initialData) {
      for (const [collectionName, records] of Object.entries(initialData ?? {})) {
        const recordMap = new Map();
        for (const [id, record] of Object.entries(records ?? {})) {
          recordMap.set(id, record);
        }

        this.db.set(collectionName, recordMap);
      }
    }
  }

  async get<Record>(collection: string, id: string) {
    return this.db.get(collection)?.get(id) as Record;
  }

  async set(collection: string, id: string, value: RecordData) {
    if (!this.db.has(collection)) this.db.set(collection, new Map());
    this.db.get(collection)!.set(id, value);
  }

  async list<Record>(collection: string) {
    return {
      records: Array.from(this.db.get(collection)?.values() ?? []) as Record[],
    };
  }

  async find<Record>(collection: string, filter: string) {
    const results = Array.from(this.db.get(collection)?.values() ?? []) as Record[];
    return {
      records: results.filter(item => evaluateFilter(item, filter)),
    };
  }

  dump() {
    let result = {};
    for (const [collectionName, recordMap] of this.db) {
      result[collectionName] = {};
      for (const [id, record] of recordMap) {
        result[collectionName][id] = record;
      }
    }
    return result;
  }

  delete(collection: string, id: string) {
    this.db.get(collection)?.delete(id);
    return Promise.resolve();
  }
}
