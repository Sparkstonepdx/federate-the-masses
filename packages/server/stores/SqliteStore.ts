import Database from 'better-sqlite3/lib/database';
import { FindOptions, RecordData, Store } from '../lib/store';
import Sqlite from 'better-sqlite3';
import { RecordPage, SchemaField } from '../../shared/core-record-types';

export default class SqliteStore implements Store {
  private db: Database;

  constructor(filename: string = 'store.db', options) {
    this.db = new Sqlite(filename, options);
    this.db.pragma('journal_mode = WAL');
  }

  static translateSchemaField(columnName: string, schema: SchemaField) {
    return `${columnName} ${schema.type}`;
  }

  async createCollection(collectionName: any, schema: Record<string, SchemaField>): Promise<void> {
    const fields = Object.entries(schema).map(entry =>
      SqliteStore.translateSchemaField(entry[0], entry[1])
    );
    return this.db.prepare(`create table ${collectionName} (${fields.join(', ')})`).run();
  }

  private addField(collection: string, fieldName: string, schema: SchemaField): Promise<void> {
    return this.db
      .prepare(
        `alter table ${collection} add column ${fieldName} ${schema.type}`,
        fieldName,
        schema.type
      )
      .run();
  }

  async addFields(collectionName: string, schema: Record<string, SchemaField>) {
    let fields = Object.entries(schema);

    return Promise.all(fields.map(field => this.addField(collectionName, field[0], field[1])));
  }

  get<Record>(collectionName: string, id: string): Promise<(Record & RecordData) | undefined> {
    return this.db.prepare(`select * from ? where id = ?`).get(collectionName, id);
  }

  async set(collectionName: string, id: string, value: RecordData): Promise<void> {
    let values = Object.entries(value);
    console.log({ values });
    const result = this.db
      .prepare(
        `insert or replace into ${collectionName} (${values.map(
          ([key]) => key
        )}) values (${values.map(([_, value]) => '?')})`
      )
      .run(...values.map(([_, value]) => value));
    console.log({ result });
    return result;
  }

  async list<Record>(CollectionName: string): Promise<RecordPage<Record & RecordData>> {
    const result = this.db.prepare(`select * from ${CollectionName};`).all();
    console.log({ result });
    return {
      records: result,
    };
    throw new Error('Method not implemented.');
  }
  find<Record>(
    collectionName: string,
    options: FindOptions
  ): Promise<RecordPage<Record & RecordData>> {
    throw new Error('Method not implemented.');
  }
  delete(collectionName: string, id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async close() {
    this.db.close();
  }
}
