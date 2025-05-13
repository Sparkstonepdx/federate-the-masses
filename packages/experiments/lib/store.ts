import { RecordPage } from './core-record-types';

export interface RecordData {
  id: string;
  is_deleted?: boolean;
  modified_at: string;
  created_at: string;
}

export interface Store {
  get<Record>(collectionName: string, id: string): Promise<(Record & RecordData) | undefined>;
  set(collectionName: string, id: string, value: RecordData): Promise<void>;
  list<Record>(CollectionName: string): Promise<RecordPage<Record & RecordData>>;
  find<Record>(collectionName: string, filter: string): Promise<RecordPage<Record & RecordData>>;
  delete(collectionName: string, id: string): Promise<void>;
}

function evaluateFilter(obj: any, filter: string) {
  const operators = {
    '=': '===',
    '!=': '!==',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
  };

  const regex = new RegExp(
    `^\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*(${Object.keys(operators)
      .map(op => op.replace(/([=<>!])/g, '\\$1'))
      .join('|')})\\s*(.+?)\\s*$`,
  );

  const match = filter.match(regex);
  if (!match) throw new Error('Invalid filter expression');

  const [, key, op, valueRaw] = match;
  const jsOp = operators[op];
  const value = JSON.parse(valueRaw.replace(/^'(.+)'$/, '"$1"')); // parse numbers, booleans, and quoted strings

  return Function('obj', `return obj["${key}"] ${jsOp} ${JSON.stringify(value)};`)(obj);
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

  delete(collection: string, id: string) {
    this.db.get(collection)?.delete(id);
    return Promise.resolve();
  }
}
