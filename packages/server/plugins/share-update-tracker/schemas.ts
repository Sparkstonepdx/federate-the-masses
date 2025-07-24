export function createInvitesCollection(userCollection: string) {
  return {
    collectionName: 'invites',
    untrackSharing: true,
    migrations: [
      {
        addFields: {
          share: { type: 'relation', collection: 'shares' },
          owner: { type: 'relation', collection: userCollection },
          secret: { type: 'string' },
        },
      },
    ],
  };
}

export const SharesCollection = {
  collectionName: 'shares',
  untrackSharing: true,
  migrations: [
    {
      addFields: {
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
  ],
};

export const ShareDependenciesCollection = {
  untrackSharing: true,
  collectionName: 'share_dependencies',
  migrations: [
    {
      addFields: {
        share: { type: 'relation', collection: 'shares' },
        parent_id: { type: 'string' },
        parent_collection: { type: 'string' },
        child_id: { type: 'string' },
        child_collection: { type: 'string' },
        field: { type: 'string' },
        relation_type: { type: 'string' },
      },
    },
  ],
};

export const ShareSubscribersCollection = {
  untrackSharing: true,
  collectionName: 'share_subscribers',
  migrations: [
    {
      addFields: {
        subscribing_server: { type: 'relation', collection: 'servers' },
        share: { type: 'relation', collection: 'shares' },
        last_sync: { type: 'datetime' },
      },
    },
  ],
};

export const ShareUpdatesCollection = {
  untrackSharing: true,
  collectionName: 'share_updates',
  migrations: [
    {
      addFields: {
        share: { type: 'relation', collection: 'shares' },
        collection: { type: 'string' },
        record_id: { type: 'string' },
        action: { type: 'string' },
      },
    },
  ],
};

export const ServersCollection = {
  untrackSharing: true,
  collectionName: 'servers',
  migrations: [
    {
      addFields: {
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
  ],
};
