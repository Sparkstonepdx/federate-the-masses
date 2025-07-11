import { nanoid } from 'nanoid';

export function generateId() {
  return nanoid();
}

export function generateURN(collectionName: string, host: string) {
  return `urn:${collectionName}:${generateId()}@${host}`;
}
