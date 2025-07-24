import { UsersCollection } from '@fedmasses/shared/system-schema';
import { expect, test } from 'vitest';
import { data, ListsCollection, TasksCollection } from '../../end-to-end-tests/lib/mock-data/tasks';
import { prettyPrint, prettyPrintArray } from '../../shared/string';
import ShareUpdateTracker from '../plugins/share-update-tracker/share-update-tracker';
import MemoryStore from '../stores/InMemoryStore';
import Server from './server';

test('expand single forward relation', async () => {
  const server = await Server.create({
    store: new MemoryStore(data),
    schemas: [TasksCollection, ListsCollection, UsersCollection],
    plugins: [ShareUpdateTracker({ userCollection: 'users' })],
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
  const server = await Server.create({
    store: new MemoryStore(data),
    schemas: [TasksCollection, ListsCollection, UsersCollection],
    plugins: [ShareUpdateTracker({ userCollection: 'users' })],
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
  const server = await Server.create({
    store: new MemoryStore(data),
    schemas: [TasksCollection, ListsCollection, UsersCollection],
    plugins: [ShareUpdateTracker({ userCollection: 'users' })],
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const list = await server.records.get('lists', 'list-1');

  if (!list) throw new Error('failed to get list');
  await server.records.expand(list, ['tasks.child.child', 'child_list']);

  expect(list).toMatchSnapshot();
});

test('expand all tasks with overlap', async () => {
  const server = await Server.create({
    store: new MemoryStore(data),
    schemas: [TasksCollection, ListsCollection, UsersCollection],
    plugins: [ShareUpdateTracker({ userCollection: 'users' })],
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const list = await server.records.get('tasks', 'task-1');

  if (!list) throw new Error('failed to get list');
  await server.records.expand(list, ['child.child', 'child.parent']);

  expect(list).toMatchSnapshot();
});
