import { Schema } from './core-record-types';

const systemSchema: Record<string, Schema> = {
  // used for url based invites
  invites: {
    collectionName: 'invites',
    untrackSharing: true,
    fields: {
      share: { type: 'relation', collection: 'shares' },
      owner: { type: 'relation', collection: 'users' },
      secret: { type: 'string' },
    },
  },
  users: {
    collectionName: 'users',
    fields: {
      name: { type: 'string' },
    },
  },
  // used for tracking what is being shared between servers
  shares: {
    collectionName: 'shares',
    untrackSharing: true,
    fields: {
      collection: { type: 'string' },
      record_id: { type: 'string' },
      // last sync when share is on another host
      last_remote_sync: { type: 'datetime' },
      server: { type: 'relation', collection: 'servers' },
      access_token: { type: 'string' },
      subcribing_server: {
        type: 'relation',
        collection: 'share_subscribers',
        via: 'share',
      },
    },
  },
  share_dependencies: {
    untrackSharing: true,
    collectionName: 'share_dependencies',
    fields: {
      share: { type: 'relation', collection: 'shares' },
      parent_id: { type: 'string' },
      parent_collection: { type: 'string' },
      child_id: { type: 'string' },
      child_collection: { type: 'string' },
    },
  },
  // remote servers subscribed to a local share or
  share_subscribers: {
    untrackSharing: true,
    collectionName: 'share_subscribers',
    fields: {
      subscribing_server: { type: 'relation', collection: 'servers' },
      share: { type: 'relation', collection: 'shares' },
      last_sync: { type: 'datetime' },
    },
  },
  // remote server per pending update
  // share_update_subscribers: {
  //   collectionName: 'share_update_subscribers',
  //   fields: {
  //     subscribing_server: { type: 'relation', collection: 'servers' },
  //     share_update: { type: 'relation', collection: 'share_updates' },
  //   },
  // },
  // local updates made to a share
  share_updates: {
    untrackSharing: true,
    collectionName: 'share_updates',
    fields: {
      share: { type: 'relation', collection: 'shares' },
      collection: { type: 'string' },
      record_id: { type: 'string' },
      action: { type: 'string' },
      // share_update_subscribers: {
      //   type: 'relation',
      //   collection: 'share_update_subscribers',
      //   via: 'share_update',
      // },
    },
  },
  // remote servers that we are sharing with
  servers: {
    untrackSharing: true,
    collectionName: 'servers',
    fields: {
      url: { type: 'string' },
      public_key: { type: 'string' },
      // share_update_subscribers: {
      //   type: 'relation',
      //   collection: 'share_update_subscribers',
      //   via: 'subscribing_server',
      // },
      share_subscribers: {
        type: 'relation',
        collection: 'share_subscribers',
        via: 'subscribing_server',
      },
    },
  },
};

export default systemSchema;
