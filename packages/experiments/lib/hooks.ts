import { Schema } from '../../shared/core-record-types';
import { RecordData } from './store';

export interface BaseParams<RecordType extends object = {}> {
  recordData: RecordData & RecordType;
  recordSchema: Schema;
}

export interface HookFnParams<RecordType> {
  beforeCreate: BaseParams;
  afterCreate: BaseParams;
  beforeDelete: BaseParams;
  afterDelete: BaseParams;
  beforeUpdate: BaseParams & { previousRecordData: RecordData & RecordType };
  afterUpdate: BaseParams & { previousRecordData: RecordData & RecordType };
}

type HookFn<T extends HookType = HookType, RecordType extends object = {}> = (
  params: HookFnParams<RecordType>[T]
) => void | Promise<void>;
type HookType =
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete';

export class HooksEngine {
  private hookMap: Map<string, Set<HookFn>>;
  constructor() {
    this.hookMap = new Map<string, Set<HookFn>>();
  }

  register<T extends HookType, RecordType extends object = {}>(
    event: T,
    collectionName: string,
    fn: HookFn<T, RecordType>
  ) {
    const key = `${event}:${collectionName}`;
    if (!this.hookMap.has(key)) this.hookMap.set(key, new Set());
    this.hookMap.get(key)!.add(fn as HookFn);
    return () => this.hookMap.get(key)!.delete(fn as HookFn);
  }

  async run<T extends HookType, RecordType extends object = {}>(
    event: T,
    collectionName: string,
    hookFnParams: HookFnParams<RecordType>[T]
  ) {
    const key = `${event}:${collectionName}`;
    for (const fn of this.hookMap.get(key) ?? []) await (fn as HookFn<T, RecordType>)(hookFnParams);
    for (const fn of this.hookMap.get(`${event}:*`) ?? [])
      await (fn as HookFn<T, RecordType>)(hookFnParams);
  }
}
