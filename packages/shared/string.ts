import { omit, pick } from 'lodash-es';
import { CollectionRecord } from '../server/lib/records';

export function prettyPrint<RecordType extends object = {}>(
  record?: CollectionRecord<RecordType> | null,
  pickFields?: string[]
) {
  if (!record) return `[] ${record}`;
  let data: any = omit(record.data(), 'created_at', 'modified_at', 'id');
  if (pickFields) {
    data = pick(record.data(), pickFields);
  }

  let prettyData = Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

  return `[${record.collection}:${record.id}] ${prettyData.join(', ')}`;
}

export function prettyPrintArray(arr: CollectionRecord[]) {
  return arr.map(record => prettyPrint(record)).join('\n');
}

export async function prettyList(
  promise: Promise<{ records: CollectionRecord[] }>,
  pickFields?: string[]
) {
  const result = await promise;
  return {
    ...result,
    records: result.records.map(record => prettyPrint(record, pickFields)),
  };
}
