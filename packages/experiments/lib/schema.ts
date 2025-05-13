import set from 'lodash-es/set';
import { Schema } from './core-record-types';

interface SchemaEnrichment {
  references?: string[];
  referencedBy?: Record<string, boolean>;
}

export class SchemaEngine {
  constructor(private schema: Record<string, Schema & SchemaEnrichment>) {
    this.computeRelationships();
  }

  computeRelationship(key: string, visitedKeys = new Set()) {
    if (visitedKeys.has(key)) return []; //this.schema[key].references ?? [];
    let references: string[] = [];
    visitedKeys.add(key);
    let schema = this.schema[key];
    if (!schema) throw new Error(`Schema doesn't exist: ${key}`);

    for (const [field, fieldSchema] of Object.entries(schema.fields)) {
      if (fieldSchema.type !== 'relation') continue;
      let nestedReferences = this.computeRelationship(fieldSchema.collection, visitedKeys).map(
        ref => [fieldSchema.collection, ref].join('.'),
      );

      set(this.schema, [key, 'referencedBy', fieldSchema.collection], true);

      if (nestedReferences.length) {
        references.push(...nestedReferences);
      } else {
        references.push(fieldSchema.collection);
      }
    }
    this.schema[key].references = references;
    return references;
  }

  computeRelationships(keys?: string[], visitedKeys = new Set()) {
    keys ??= Object.keys(this.schema);

    for (const key of keys) {
      this.computeRelationship(key, visitedKeys);
    }
  }

  get(collectionName: string) {
    return this.schema[collectionName];
  }
}
