import { RecordPage, Schema, SchemaField } from '../../shared/core-record-types';

export interface RecordData {
  id: string;
  is_deleted?: boolean;
  modified_at: string;
  created_at: string;
  host: string;
}

export interface FindOptions {
  filter?: string;
  page?: number;
  perPage?: number;
  sort?: string;
  fields?: string;
  expand?: string[];
}

export interface Store {
  get<Record>(collectionName: string, id: string): Promise<(Record & RecordData) | undefined>;
  set(collectionName: string, id: string, value: RecordData): Promise<void>;
  list<Record>(CollectionName: string): Promise<RecordPage<Record & RecordData>>;
  find<Record>(
    collectionName: string,
    options: FindOptions
  ): Promise<RecordPage<Record & RecordData>>;
  delete(collectionName: string, id: string): Promise<void>;
  close(): Promise<void>;

  createCollection(collectionName, fields: Record<string, SchemaField>): Promise<void>;
  addFields(collectionName: string, schema: Record<string, SchemaField>): Promise<void>;
  removeFields(collectionName: string, fields: string[]): Promise<void>;
  addIndex(collectionName: string, indexName: string, fields: string[]): Promise<void>;
  removeIndex(collectionName: string, indexName: string): Promise<void>;

  // add these for completeness:

  changeFieldType(collectionName: string, field: string, newSchema: SchemaField): Promise<void>;

  // addConstraint?(coll: string, constraintName: string, sql: string): Promise<void>; // e.g. FOREIGN KEY, CHECK
  // removeConstraint?(coll: string, constraintName: string): Promise<void>;

  // renameIndex?(coll: string, oldName: string, newName: string): Promise<void>;

  dropTable?(coll: string): Promise<void>;
}
