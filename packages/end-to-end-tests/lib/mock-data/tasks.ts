import { Schema } from '../../../shared/core-record-types';
import systemSchema from '../../../shared/system-schema';

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

export const schema: Record<string, Schema> = {
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

export const data = {
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
