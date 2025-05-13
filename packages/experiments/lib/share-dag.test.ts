import { expect, test, vi } from 'vitest';
import { buildShareGraph } from './share-dag';
import Server from './federated-share';
import { MemoryStore } from './store';
import systemSchema from './system-schema';
import { SchemaEngine } from './schema';
import { Schema, Shares } from './core-record-types';
import { prettyPrintArray } from './string';

let schema: Record<string, Schema> = {
  ...systemSchema,
  tasks: {
    collectionName: 'tasks',
    fields: {
      list: { type: 'relation', collection: 'lists', required: true },
      parent: { type: 'relation', collection: 'tasks' },
      child: { type: 'relation', collection: 'tasks', via: 'parent' },
      title: { type: 'string' },
      content: { type: 'string', required: true },
    },
  },
  lists: {
    collectionName: 'lists',
    fields: {
      list: { type: 'relation', collection: 'lists' },
      tasks: { type: 'relation', collection: 'tasks', via: 'list' },
      child_list: { type: 'relation', collection: 'lists', via: 'list' },
      title: { type: 'string' },
    },
  },
};

/*
    list-1 (Project Alpha) 5 items (task-3 twice)
    ├── task-1: Design homepage
    │   └── task-2: Develop homepage
    │       └── task-3: Review homepage   (belongs to list-2)
    └── list-2 (Sublist of Alpha)
        └── task-3: Review homepage       (same as above)

    list-3 (Project Beta)
    └── task-4: Setup database
*/

test('dep list-1', async () => {
  const server = new Server({
    store: new MemoryStore(initialData),
    schema: new SchemaEngine(schema),
    identity: { url: 'test-server', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'lists',
    record_id: 'list-1',
  });
  await buildShareGraph(server, share);

  let list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(5);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(
    `
    "[share_dependencies:1] share: "0", parent_id: "0", parent_collection: "shares", child_id: "list-1", child_collection: "lists"
    [share_dependencies:2] share: "0", parent_id: "list-1", parent_collection: "lists", child_id: "task-1", child_collection: "tasks"
    [share_dependencies:3] share: "0", parent_id: "list-1", parent_collection: "lists", child_id: "task-2", child_collection: "tasks"
    [share_dependencies:4] share: "0", parent_id: "list-1", parent_collection: "lists", child_id: "list-2", child_collection: "lists"
    [share_dependencies:5] share: "0", parent_id: "task-2", parent_collection: "tasks", child_id: "task-3", child_collection: "tasks""
  `,
  );
});

test('dep list-2', async () => {
  const server = new Server({
    store: new MemoryStore(initialData),
    schema: new SchemaEngine(schema),
    identity: { url: 'test-server', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'lists',
    record_id: 'list-2',
  });
  await buildShareGraph(server, share);

  const list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(2);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(`
    "[share_dependencies:7] share: "6", parent_id: "6", parent_collection: "shares", child_id: "list-2", child_collection: "lists"
    [share_dependencies:8] share: "6", parent_id: "list-2", parent_collection: "lists", child_id: "task-3", child_collection: "tasks""
  `);
});

test('dep list-3', async () => {
  const server = new Server({
    store: new MemoryStore(initialData),
    schema: new SchemaEngine(schema),
    identity: { url: 'test-server', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'lists',
    record_id: 'list-3',
  });
  await buildShareGraph(server, share);

  const list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(2);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(`
    "[share_dependencies:10] share: "9", parent_id: "9", parent_collection: "shares", child_id: "list-3", child_collection: "lists"
    [share_dependencies:11] share: "9", parent_id: "list-3", parent_collection: "lists", child_id: "task-4", child_collection: "tasks""
  `);
});

test('dep task-3', async () => {
  const server = new Server({
    store: new MemoryStore(initialData),
    schema: new SchemaEngine(schema),
    identity: { url: 'test-server', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'tasks',
    record_id: 'task-3',
  });
  await buildShareGraph(server, share);

  const list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(1);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(
    `"[share_dependencies:13] share: "12", parent_id: "12", parent_collection: "shares", child_id: "task-3", child_collection: "tasks""`,
  );
});

const initialData = {
  lists: {
    'list-1': {
      id: 'list-1',
      title: 'Project Alpha',
    },
    'list-2': {
      id: 'list-2',
      title: 'Sublist of Alpha',
      list: 'list-1',
    },
    'list-3': {
      id: 'list-3',
      title: 'Project Beta',
    },
  },
  tasks: {
    'task-1': {
      id: 'task-1',
      title: 'Design homepage',
      content: 'Create wireframes and mockups',
      list: 'list-1',
    },
    'task-2': {
      id: 'task-2',
      title: 'Develop homepage',
      content: 'Convert design into code',
      list: 'list-1',
      parent: 'task-1',
    },
    'task-3': {
      id: 'task-3',
      title: 'Review homepage',
      content: 'Internal QA and feedback',
      list: 'list-2',
      parent: 'task-2',
    },
    'task-4': {
      id: 'task-4',
      title: 'Setup database',
      content: 'Install PostgreSQL and configure',
      list: 'list-3',
    },
  },
};
