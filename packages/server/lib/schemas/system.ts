export const FtmSystemKV = {
  collectionName: 'ftm_system_kv',
  untrackSharing: true,
  migrations: [
    {
      version: 1,
      addFields: {
        value: { type: 'json' },
      },
    },
  ],
};

export const FtmSystemMigrations = {
  collectionName: 'ftm_system_migrations',
  untrackSharing: true,
  migrations: [
    {
      version: 1,
      addFields: {
        version: { type: 'int' },
      },
    },
  ],
};

export const UsersSchema = {
  collectionName: 'users',
  migrations: [
    {
      version: 1,
      addFields: { type: 'string' },
    },
  ],
};
