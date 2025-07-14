import { pick } from 'lodash-es';
import { SchemaField, ShareDependencies, ShareUpdates } from '../../shared/core-record-types';
import { BaseParams, HookFnParams } from './hooks';
import { Record, RecordEngine } from './records';
import { createDependencyTree, deleteDependencyTree } from './share-dag';
import { prettyPrint } from '../../shared/string';

export function attachShareUpdateTracker(records: RecordEngine) {
  let listeners = [
    records.hooks.register('afterCreate', '*', params => afterCreate(records, params)),
    records.hooks.register('afterUpdate', '*', params => afterUpdate(records, params)),
    records.hooks.register('afterDelete', '*', params => afterDelete(records, params)),
  ];

  return function unsubscribe() {
    for (const listener of listeners) {
      listener();
    }
  };
}

type Reference = { relation_type: 'via' | 'field'; field: string; record: Record<any> };

export async function findRelatedRecords<RecordType extends object = {}>(
  records: RecordEngine,
  record: Record<RecordType>,
  ignoreViaRecords?: boolean
) {
  let references: Reference[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(record.schema.fields)) {
    if (fieldSchema.type !== 'relation') continue;
    if (fieldSchema.via && !ignoreViaRecords) {
      const result = await records.find(fieldSchema.collection, {
        filter: `${fieldName} = '${record.id}'`,
      });
      references.push(
        ...result.records.map(
          record =>
            ({
              record,
              relation_type: 'via',
              field: fieldSchema.via as string,
            } as Reference)
        )
      );
      continue;
    }
    if (record.get(fieldName as keyof RecordType)) {
      const result = await records.get<RecordType>(
        fieldSchema.collection,
        record.get(fieldName as keyof RecordType) as string
      );
      if (!result)
        throw new Error(
          `referenced record not found: ${prettyPrint(record)} ${JSON.stringify(fieldName)}`
        );
      references.push({ record: result, relation_type: 'field', field: fieldName });
    }
  }
  return references;
}

export async function afterCreate(records: RecordEngine, params: BaseParams) {
  if (params.recordSchema.untrackSharing) return;

  const record = new Record(params.recordSchema, params.recordData);
  const relatedRecords = await findRelatedRecords(records, record, true);

  const relatedDependencies = await records.find<ShareDependencies>('share_dependencies', {
    filter: `child_id in ('${relatedRecords.map(record => record.record.id).join("', '")}')`,
  });

  let shareIds = new Set<string>();
  let parentIds = new Set<string>();
  for (const parentRecord of relatedDependencies.records) {
    parentIds.add(parentRecord.get('child_id'));
    shareIds.add(parentRecord.get('share'));
    await records.create<ShareDependencies>('share_dependencies', {
      share: parentRecord.get('share'),
      parent_collection: parentRecord.get('child_collection'),
      parent_id: parentRecord.get('child_id'),
      child_collection: record.collection,
      child_id: record.id,
    });
  }
  for (const shareId of shareIds) {
    //add current record to each share
    await records.create<ShareUpdates>('share_updates', {
      share: shareId,
      collection: record.collection,
      record_id: record.id,
      action: 'create',
    });

    // all records that record references that isn't in a share should be a child of record
    for (const relatedRecord of relatedRecords) {
      if (parentIds.has(relatedRecord.record.id)) continue;
      await records.create<ShareDependencies>('share_dependencies', {
        share: shareId,
        parent_collection: record.collection,
        parent_id: record.id,
        child_collection: relatedRecord.record.collection,
        child_id: relatedRecord.record.id,
      });
      await records.create<ShareUpdates>('share_updates', {
        share: shareId,
        collection: relatedRecord.record.collection,
        record_id: relatedRecord.record.id,
        action: 'create',
      });
    }
  }
}

export async function afterUpdate(records: RecordEngine, params: HookFnParams<any>['afterUpdate']) {
  if (params.recordSchema.untrackSharing) return;

  const record = new Record<any>(params.recordSchema, params.recordData);

  const changedFields = new Set<{ name: string; schema: SchemaField }>();

  for (const [name, schema] of Object.entries(params.recordSchema.fields)) {
    if (schema.type !== 'relation') continue;
    if (params.recordData[name] !== params.previousRecordData[name]) {
      changedFields.add({ name, schema });
    }
  }

  const existingParentDeps = await records.find<ShareDependencies>('share_dependencies', {
    filter: `child_id = '${record.id}'`,
  });

  // if we removed a field that linked it to a parent, we should delete the tree
  for (const parentDep of existingParentDeps.records) {
    for (const changedField of changedFields) {
      if (
        parentDep.get('relation_type') === 'via' &&
        changedField.name === parentDep.get('field')
      ) {
        await deleteDependencyTree(records, parentDep);
      }
    }
  }

  for (const changedField of changedFields) {
    if (!record.get(changedField.name as string)) continue;
    let newShareDeps = await records.find<ShareDependencies>('share_dependencies', {
      filter: `child_id = '${record.get(changedField.name)}'`,
    });
    for (const dep of newShareDeps.records) {
      const parentRecord = await records.get<any>(dep.get('child_collection'), dep.get('child_id'));
      if (!parentRecord) throw new Error('failed to fetch referenced record');
      await createDependencyTree(
        records,
        {
          collection: record.collection,
          recordId: record.id,
          field: changedField.name,
          relation_type: 'via',
          parent: parentRecord,
        },
        dep.get('share'),
        true
      );
    }
  }

  const shareDependencies = await records.find<ShareDependencies>('share_dependencies', {
    filter: `child_id = '${params.recordData.id}'`,
  });
  let visitedShares = new Set();
  for (const shareDependency of shareDependencies.records) {
    if (visitedShares.has(shareDependency.get('share'))) {
      continue;
    }
    await records.create<ShareUpdates>('share_updates', {
      share: shareDependency.get('share'),
      collection: params.recordSchema.collectionName,
      record_id: params.recordData.id,
      action: 'update',
    });
    visitedShares.add(shareDependency.get('share'));
  }
}

export async function afterDelete(records: RecordEngine, params: BaseParams) {
  if (params.recordSchema.untrackSharing) return;

  const record = new Record(params.recordSchema, params.recordData);
  const relatedDependencies = await records.find<ShareDependencies>('share_dependencies', {
    filter: `child_id = '${record.id}'`,
  });

  for (const child of relatedDependencies.records) {
    await deleteDependencyTree(records, child);
  }
}
