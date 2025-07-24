import { SchemaField } from '@fedmasses/shared/core-record-types';
import { evaluateFilter } from '../lib/sql-filter';
import { Store, RecordData, FindOptions } from '../lib/store';

export default class MemoryStore implements Store {
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

  async createCollection(collectionName: any, fields: Record<string, SchemaField>): Promise<void> {}

  async addFields(collectionName: string, schema: Record<string, SchemaField>): Promise<void> {}

  async removeField(collection: string, fieldName: string) {}

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

  async find<Record>(collection: string, options: FindOptions) {
    options.page ??= 1;
    options.perPage ??= 500;
    let records = Array.from(this.db.get(collection)?.values() ?? []) as Record[];
    if (options.filter) {
      records = records.filter(item => evaluateFilter(item, options.filter!));
    }

    if (options.sort) {
      const sortSpec = parseSort(options.sort);
      records.sort((a, b) => {
        for (const { field, direction } of sortSpec) {
          const aVal = a[field];
          const bVal = b[field];
          if (aVal === bVal) continue;
          const cmp = aVal > bVal ? 1 : -1;
          return direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    if (options.page) {
      let offset = (options.page - 1) * options.perPage;
      records = records.splice(offset, options.perPage);
    }

    return {
      records,
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
export function parseSort(sortStr: string): SortSpec[] {
  return sortStr.split(',').map(part => {
    const trimmed = part.trim();
    if (trimmed.startsWith('-')) {
      return { field: trimmed.slice(1), direction: 'desc' };
    }
    return { field: trimmed, direction: 'asc' };
  });
} /// Mock In Memory Store

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}
