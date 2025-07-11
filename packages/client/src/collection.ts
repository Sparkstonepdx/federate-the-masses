import { FindOptions } from '../../experiments/lib/store';
import { Fetch } from '../../shared/types';

interface CollectionOpts {
  cache: Map<string, string>;
  fetch: Fetch;
  serverUrl: string;
}

export class Collection {
  constructor(private collectionName: string, private opts: CollectionOpts) {}

  authWithPassword(email: string, password: string) {}
  authWith0Auth(provider) {
    throw new Error('not implemented');
  }

  authRefresh() {
    throw new Error('not implemented');
  }

  requestPasswordReset(email: string) {
    throw new Error('not implemented');
  }

  confirmPasswordReset(token, newPassword: string, confirmPassword: string) {
    throw new Error('not implemented');
  }

  async find(options: FindOptions = {}) {
    const url = new URL(`/api/collections/${this.collectionName}/records`, this.opts.serverUrl);
    Object.entries(options).forEach(entry => {
      url.searchParams.set(entry[0], entry[1]);
    });

    const response = await this.opts.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to findAll`, { cause: response });
    }
    return response.json();
  }

  async findAll(options: FindOptions = {}) {
    let records = [];
    options.page = 1;
    options.perPage ??= 500;
    let lastPayload;

    while (true) {
      lastPayload = await this.find(options);
      records.push(...lastPayload.records);
      if (lastPayload.records.length < options.perPage) break;
      options.page++;
    }

    return {
      records,
    };
  }

  async schema() {
    const url = new URL(`/api/collections/${this.collectionName}`, this.opts.serverUrl);
    const response = await this.opts.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to schema`, { cause: response });
    }
    return response.json();
  }

  findOne() {
    throw new Error('not implemented');
  }

  create() {
    throw new Error('not implemented');
  }

  update() {
    throw new Error('not implemented');
  }

  delete() {
    throw new Error('not implemented');
  }

  subscribe() {}
}
