import { ShareDependencies, Shares, ShareUpdates } from './core-record-types';
import type Server from './federated-share';
import { Record, RecordEngine } from './records';

interface QueuedItem {
  collection: string;
  recordId: string;
  parent: Record<any>;
  field?: string;
  relation_type: 'via' | 'field';
}

export async function buildShareGraph(
  records: RecordEngine,
  item: QueuedItem,
  shareId: string,
  createUpdates: boolean = false,
) {
  let visitedNodes = new Set();
  let queue: QueuedItem[] = [item];
  let i = 0;
  console.dir({ item }, { depth: 3 });

  for (const next of queue) {
    if (visitedNodes.has(next.recordId)) continue;
    visitedNodes.add(next.recordId);
    const record = await records.get(next.collection, next.recordId);
    if (!record) throw new Error(`record not found: ${JSON.stringify(next)}`);
    await records.create<ShareDependencies>('share_dependencies', {
      share: shareId,
      parent_id: next.parent.id,
      parent_collection: next.parent.collection,
      child_id: record.id,
      child_collection: record.collection,
      field: next.field,
      relation_type: next.relation_type,
    });
    if (createUpdates) {
      await records.create<ShareUpdates>('share_updates', {
        share: shareId,
        collection: record.collection,
        record_id: record.id,
        action: 'create',
      });
    }
    const referencedRecords = await getReferencedRecords(records, record);
    queue.push(...referencedRecords);
  }
}

async function getReferencedRecords(records: RecordEngine, record: Record<any>) {
  let queueItems: QueuedItem[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(record.schema.fields)) {
    if (fieldSchema.type !== 'relation') continue;
    if (fieldSchema.via) {
      const result = await records.find(
        fieldSchema.collection,
        `${fieldSchema.via} = '${record.id}'`,
      );
      queueItems.push(
        ...result.records.map(
          r =>
            ({
              collection: r.collection,
              field: fieldSchema.via,
              relation_type: 'via',
              recordId: r.id,
              parent: record,
            }) as QueuedItem,
        ),
      );
      continue;
    }

    if (!record[fieldName]) continue;
    queueItems.push({
      collection: fieldSchema.collection,
      recordId: record[fieldName],
      field: fieldName,
      relation_type: 'field',
      parent: record,
    });
  }
  return queueItems;
}
