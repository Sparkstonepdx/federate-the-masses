import set from "lodash-es/set";

export class SchemaEngine {
  constructor(private schema) {
    this.computeRelationships();
    console.dir(this.schema, { depth: 10 });
  }

  computeRelationship(key: string, visitedKeys = new Set()) {
    if (visitedKeys.has(key)) return []; //this.schema[key].references ?? [];
    let references = [];
    visitedKeys.add(key);
    for (const [field, detail] of Object.entries(this.schema[key].fields)) {
      if (detail.type !== "relation") continue;
      let nestedReferences = this.computeRelationship(
        detail.collection,
        visitedKeys,
      ).map((ref) => [detail.collection, ref].join("."));

      set(this.schema, [key, "referencedBy", detail.collection], true);

      if (nestedReferences.length) {
        references.push(...nestedReferences);
      } else {
        references.push(detail.collection);
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

  async getAllRelationships(collectionName: string) {}
}
