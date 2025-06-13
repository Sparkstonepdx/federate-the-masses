import { expect, test, vi } from 'vitest';
import Server from './server';
import { MemoryStore } from './store';
import { SchemaEngine } from './schema';
import { data, schema } from './mock-data/tasks';
import { prettyPrint, prettyPrintArray } from './string';

test('expand single forward relation', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const list = await server.records.get('lists', 'list-2');

  if (!list) throw new Error('failed to get list');
  await server.records.expand(list, ['list']);

  expect(prettyPrint(list.expand.list)).toMatchInlineSnapshot(
    `"[lists:list-1] title: "Project Alpha""`
  );
});

test('expand via relation', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const list = await server.records.get('lists', 'list-2');

  if (!list) throw new Error('failed to get list');
  await server.records.expand(list, ['tasks']);

  expect(prettyPrintArray(list.expand.tasks)).toMatchInlineSnapshot(
    `"[tasks:task-3] title: "Review homepage", content: "Internal QA and feedback", list: "list-2", parent: "task-2""`
  );
});

test('expand all tasks', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const list = await server.records.get('lists', 'list-1');

  if (!list) throw new Error('failed to get list');
  await server.records.expand(list, ['tasks.child.child', 'child_list']);

  expect(list).toMatchSnapshot();
});

test('expand all tasks with overlap', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const list = await server.records.get('tasks', 'task-1');

  if (!list) throw new Error('failed to get list');
  await server.records.expand(list, ['child.child', 'child.parent']);

  expect(list).toMatchSnapshot();
});
