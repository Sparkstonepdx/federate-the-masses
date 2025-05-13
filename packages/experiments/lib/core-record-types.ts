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

type SchemaField = (RelationField | StringField) & FieldModifiers;

export interface Schema {
  collectionName: string;
  fields: Record<string, SchemaField>;
}

export interface Shares {
  collection: string;
  record_id: string;
  server: Relation;
  access_token: string;
  subscribing_server: Relation;
}

export interface ShareDependencies {
  share: Relation;
  parent_id: string;
  parent_collection: string;
  child_id: string;
  child_collection: string;
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
