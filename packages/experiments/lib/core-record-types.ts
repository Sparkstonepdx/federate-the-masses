type Relation = string;

interface FieldModifiers {
  required?: boolean;
}

interface RelationField {
  type: 'relation';
  collection: string;
  via?: string;
}

interface StringField {
  type: 'string';
}

interface DatetimeField {
  type: 'datetime';
}

type SchemaField = (RelationField | StringField | DatetimeField) & FieldModifiers;

export interface Schema {
  collectionName: string;
  untrackSharing?: boolean;
  fields: Record<string, SchemaField>;
}

export interface Shares {
  collection: string;
  record_id: string;
  server: Relation;
  access_token: string;
  subscribing_server: Relation;
  last_remote_sync: string;
}

export interface ShareDependencies {
  share: Relation;
  parent_id: string;
  parent_collection: string;
  child_id: string;
  child_collection: string;
}

export interface ShareUpdates {
  share: string;
  collection: string;
  record_id: string;
  action: string;
}

export interface Servers {
  url: string;
  public_key: string;
}

export interface Invites {
  share: string;
  owner: string;
  secret: string;
}

export interface RecordPage<Type> {
  records: Type[];
}

export interface ShareSubscribers {
  subscribing_server: string;
  share: string;
}
