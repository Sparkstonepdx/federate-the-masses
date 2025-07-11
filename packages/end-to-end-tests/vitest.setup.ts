import { vi } from 'vitest';

let lastId = 0;

vi.mock('../shared/urn', async () => {
  console.log('mock');
  const actual = await vi.importActual<any>('../shared/urn');
  console.log({ actual });
  function generateId() {
    return `${lastId++}`;
  }
  return {
    ...actual,
    generateId,
    // optionally mock generateURN too
    generateURN: (collectionName: string, host: string) =>
      `urn:${collectionName}:${generateId()}@${host}`,
  };
});
