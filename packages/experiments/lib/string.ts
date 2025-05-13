import { omit } from 'lodash-es';
import { Record } from './records';

export function prettyPrint<RecordType extends object = {}>(record?: Record<RecordType> | null) {
  if (!record) return `[] ${record}`;
  let data = omit(record.data(), 'created_at', 'modified_at', 'id');

  let prettyData = Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

  return `[${record.collection}:${record.id}] ${prettyData.join(', ')}`;
}

export function prettyPrintArray(arr: Record[]) {
  return arr.map(prettyPrint).join('\n');
}
