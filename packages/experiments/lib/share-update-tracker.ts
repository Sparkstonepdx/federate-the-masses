import { SchemaField, ShareDependencies, ShareUpdates } from './core-record-types';
import { BaseParams, HookFnParams } from './hooks';
import { Record, RecordEngine } from './records';
import { buildShareGraph } from './share-dag';
import { prettyPrint } from './string';

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
  ignoreViaRecords?: boolean,
) {
  let references: Reference[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(record.schema.fields)) {
    if (fieldSchema.type !== 'relation') continue;
    if (fieldSchema.via && !ignoreViaRecords) {
      const result = await records.find(fieldSchema.collection, `${fieldName} = '${record.id}'`);
      references.push(
        ...result.records.map(
          record =>
            ({
              record,
              relation_type: 'via',
              field: fieldSchema.via as string,
            }) as Reference,
        ),
      );
      continue;
    }
    if (record.get(fieldName as keyof RecordType)) {
      const result = await records.get<RecordType>(
        fieldSchema.collection,
        record.get(fieldName as keyof RecordType) as string,
      );
      if (!result)
        throw new Error(
          `referenced record not found: ${prettyPrint(record)} ${JSON.stringify(fieldName)}`,
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

  const relatedDependencies = await records.find<ShareDependencies>(
    'share_dependencies',
    `child_id in ('${relatedRecords.map(record => record.id).join("', '")}')`,
  );

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
      if (parentIds.has(relatedRecord.id)) continue;
      await records.create<ShareDependencies>('share_dependencies', {
        share: shareId,
        parent_collection: record.collection,
        parent_id: record.id,
        child_collection: relatedRecord.collection,
        child_id: relatedRecord.id,
      });
      await records.create<ShareUpdates>('share_updates', {
        share: shareId,
        collection: relatedRecord.collection,
        record_id: relatedRecord.id,
        action: 'create',
      });
    }
  }
}

export async function afterUpdate(records: RecordEngine, params: HookFnParams<any>['afterUpdate']) {
  if (params.recordSchema.untrackSharing) return;

  const record = new Record<any>(params.recordSchema, params.recordData);
  const relatedRecords = await findRelatedRecords(records, record);

  const changedFields = new Set<{ name: string; schema: SchemaField }>();

  for (const [name, schema] of Object.entries(params.recordSchema.fields)) {
    if (schema.type !== 'relation') continue;
    if (params.recordData[name] !== params.previousRecordData[name]) {
      changedFields.add({ name, schema });
    }
  }

  const existingParentDeps = await records.find<ShareDependencies>(
    'share_dependencies',
    `child_id = '${record.id}'`,
  );

  console.dir({ changedFields, existingParentDeps }, { depth: 10 });

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
    let newShareDeps = await records.find<ShareDependencies>(
      'share_dependencies',
      `child_id = '${record.get(changedField.name)}'`,
    );
    console.dir({ newShareDeps }, { depth: 10 });
    for (const dep of newShareDeps.records) {
      console.dir({ dep }, { depth: 5 });
      const parentRecord = await records.get<any>(dep.get('child_collection'), dep.get('child_id'));
      if (!parentRecord) throw new Error('failed to fetch referenced record');
      await buildShareGraph(
        records,
        {
          collection: record.collection,
          recordId: record.id,
          field: changedField.name,
          relation_type: 'via',
          parent: parentRecord,
        },
        dep.get('share'),
        true,
      );
      // await createDependencyTree(records, dep);
    }
  }

  // update direct references
  // const share_dependencies = await records.find<ShareDependencies>(
  //   'share_dependencies',
  //   `child_id = '${params.recordData.id}' or parent_id = '${params.recordData.id}'`,
  // );
  // for (const dep of share_dependencies.records) {
  //   await records.create('share_updates', {
  //     share: dep.get('share'),
  //     action: 'update',
  //     collection: params.recordSchema.collectionName,
  //     record_id: params.recordData.id,
  //   });
  // }

  // update when we have a relation to a direct reference
}

export async function afterDelete(records: RecordEngine, params: BaseParams) {
  if (params.recordSchema.untrackSharing) return;

  const record = new Record(params.recordSchema, params.recordData);
  const relatedDependencies = await records.find<ShareDependencies>(
    'share_dependencies',
    `child_id = '${record.id}'`,
  );

  for (const child of relatedDependencies.records) {
    await deleteDependencyTree(records, child);
  }
}

async function deleteDependencyTree(records: RecordEngine, record: Record<ShareDependencies>) {
  let children = await records.find<ShareDependencies>(
    'share_dependencies',
    `parent_id = '${record.get('child_id')}' and share = '${record.get('share')}' `,
  );
  await records.delete('share_dependencies', record.id);
  await records.create<ShareUpdates>('share_updates', {
    share: record.get('share'),
    collection: record.get('child_collection'),
    record_id: record.get('child_id'),
    action: 'delete',
  });

  while (children.records.length > 0) {
    for (const child of children.records) {
      await records.delete('share_dependencies', child.id);
      await records.create<ShareUpdates>('share_updates', {
        share: child.get('share'),
        collection: child.get('child_collection'),
        record_id: child.get('child_id'),
        action: 'delete',
      });
    }
    let childIds = children.records.map(child => child.get('child_id'));
    children = await records.find<ShareDependencies>(
      'share_dependencies',
      `share = '${record.get('share')}' and parent_id in ('${childIds.join(`', '`)}')`,
    );
  }
}

async function createDependencyTree(records: RecordEngine, record: Record<ShareDependencies>) {}
