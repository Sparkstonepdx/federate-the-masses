import { ShareDependencies, Shares } from './core-record-types';
import type Server from './federated-share';
import { Record } from './records';

interface QueuedItem {
  collection: string;
  recordId: string;
  parent: Record<any>;
}

export async function buildShareGraph(server: Server, share: Record<Shares>) {
  let visitedNodes = new Set();
  let collection = share.get('collection');
  let recordId = share.get('record_id');
  let queue: QueuedItem[] = [{ collection, recordId, parent: share }];
  let i = 0;

  for (const next of queue) {
    if (visitedNodes.has(next.recordId)) continue;
    visitedNodes.add(next.recordId);
    const record = await server.records.get(next.collection, next.recordId);
    if (!record) throw new Error(`record not found: ${JSON.stringify(next)}`);
    await server.records.create<ShareDependencies>('share_dependencies', {
      share: share.id,
      parent_id: next.parent.id,
      parent_collection: next.parent.collection,
      child_id: record.id,
      child_collection: record.collection,
    });
    const referencedRecords = await getReferencedRecords(server, record);
    queue.push(...referencedRecords);
  }
}

async function getReferencedRecords(server: Server, record: Record<any>) {
  let records: QueuedItem[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(record.schema.fields)) {
    if (fieldSchema.type !== 'relation') continue;
    if (fieldSchema.via) {
      const result = await server.records.find(
        fieldSchema.collection,
        `${fieldSchema.via} = '${record.id}'`,
      );
      records.push(
        ...result.records.map(r => ({
          collection: r.collection,
          recordId: r.id,
          parent: record,
        })),
      );
      continue;
    }

    if (!record[fieldName]) continue;
    records.push({
      collection: fieldSchema.collection,
      recordId: record[fieldName],
      parent: record,
    });
  }
  return records;
}
