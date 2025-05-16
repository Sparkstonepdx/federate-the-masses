import { expect, test, vi } from 'vitest';
import { createDependencyTree } from './share-dag';
import Server from './federated-share';
import { MemoryStore } from './store';
import systemSchema from './system-schema';
import { SchemaEngine } from './schema';
import { Schema, Shares } from './core-record-types';
import { prettyPrintArray } from './string';
import { data, schema } from './mock-data/tasks';

test('dep list-1', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'lists',
    record_id: 'list-1',
  });
  await createDependencyTree(
    server.records,
    {
      collection: share.get('collection'),
      recordId: share.get('record_id'),
      relation_type: 'field',
      parent: share,
      field: 'child_id',
    },
    share.id,
  );

  let list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(5);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(
    `
    "[share_dependencies:urn:share_dependencies:1@test-server.com] host: "test-server.com", share: "urn:shares:0@test-server.com", parent_id: "urn:shares:0@test-server.com", parent_collection: "shares", child_id: "list-1", child_collection: "lists", field: "child_id", relation_type: "field"
    [share_dependencies:urn:share_dependencies:2@test-server.com] host: "test-server.com", share: "urn:shares:0@test-server.com", parent_id: "list-1", parent_collection: "lists", child_id: "task-1", child_collection: "tasks", field: "list", relation_type: "via"
    [share_dependencies:urn:share_dependencies:3@test-server.com] host: "test-server.com", share: "urn:shares:0@test-server.com", parent_id: "list-1", parent_collection: "lists", child_id: "task-2", child_collection: "tasks", field: "list", relation_type: "via"
    [share_dependencies:urn:share_dependencies:4@test-server.com] host: "test-server.com", share: "urn:shares:0@test-server.com", parent_id: "list-1", parent_collection: "lists", child_id: "list-2", child_collection: "lists", field: "list", relation_type: "via"
    [share_dependencies:urn:share_dependencies:5@test-server.com] host: "test-server.com", share: "urn:shares:0@test-server.com", parent_id: "task-2", parent_collection: "tasks", child_id: "task-3", child_collection: "tasks", field: "parent", relation_type: "via""
  `,
  );
});

test('dep list-2', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'lists',
    record_id: 'list-2',
  });
  await createDependencyTree(
    server.records,
    {
      collection: share.get('collection'),
      recordId: share.get('record_id'),
      relation_type: 'field',
      parent: share,
      field: 'child_id',
    },
    share.id,
  );

  const list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(2);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(`
    "[share_dependencies:urn:share_dependencies:7@test-server.com] host: "test-server.com", share: "urn:shares:6@test-server.com", parent_id: "urn:shares:6@test-server.com", parent_collection: "shares", child_id: "list-2", child_collection: "lists", field: "child_id", relation_type: "field"
    [share_dependencies:urn:share_dependencies:8@test-server.com] host: "test-server.com", share: "urn:shares:6@test-server.com", parent_id: "list-2", parent_collection: "lists", child_id: "task-3", child_collection: "tasks", field: "list", relation_type: "via""
  `);
});

test('dep list-3', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'lists',
    record_id: 'list-3',
  });
  await createDependencyTree(
    server.records,
    {
      collection: share.get('collection'),
      recordId: share.get('record_id'),
      relation_type: 'field',
      parent: share,
      field: 'child_id',
    },
    share.id,
  );

  const list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(2);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(`
    "[share_dependencies:urn:share_dependencies:10@test-server.com] host: "test-server.com", share: "urn:shares:9@test-server.com", parent_id: "urn:shares:9@test-server.com", parent_collection: "shares", child_id: "list-3", child_collection: "lists", field: "child_id", relation_type: "field"
    [share_dependencies:urn:share_dependencies:11@test-server.com] host: "test-server.com", share: "urn:shares:9@test-server.com", parent_id: "list-3", parent_collection: "lists", child_id: "task-4", child_collection: "tasks", field: "list", relation_type: "via""
  `);
});

test('dep task-3', async () => {
  const server = new Server({
    store: new MemoryStore(data),
    schema: new SchemaEngine(schema),
    identity: { url: 'http://test-server.com', public_key: 'asdf' },
  });

  const share = await server.records.create<Shares>('shares', {
    collection: 'tasks',
    record_id: 'task-3',
  });
  await createDependencyTree(
    server.records,
    {
      collection: share.get('collection'),
      recordId: share.get('record_id'),
      relation_type: 'field',
      parent: share,
      field: 'child_id',
    },
    share.id,
  );

  const list = await server.records.find('share_dependencies', `share = '${share.id}'`);

  expect(list.records.length).toEqual(1);

  expect(prettyPrintArray(list.records)).toMatchInlineSnapshot(
    `"[share_dependencies:urn:share_dependencies:13@test-server.com] host: "test-server.com", share: "urn:shares:12@test-server.com", parent_id: "urn:shares:12@test-server.com", parent_collection: "shares", child_id: "task-3", child_collection: "tasks", field: "child_id", relation_type: "field""`,
  );
});
