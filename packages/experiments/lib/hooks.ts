import { RecordData } from "./store";

type HookFn = (record: RecordData) => void | Promise<void>;
type HookType =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete";

export class HooksEngine {
  private hookMap: Map<string, HookFn[]>;
  constructor() {
    this.hookMap = new Map<string, HookFn[]>();
  }

  async register(event: HookType, collectionName: string, fn: HookFn) {
    const key = `${event}:${collectionName}`;
    if (!this.hookMap.has(key)) this.hookMap.set(key, []);
    this.hookMap.get(key)!.push(fn);
  }

  async run(event: HookType, collectionName: string, record: RecordData) {
    const key = `${event}:${collectionName}`;
    for (const fn of this.hookMap.get(key) ?? []) await fn(record);
  }
}
