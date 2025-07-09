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

  getList() {
    throw new Error('not implemented');
  }

  async getFullList() {
    const url = new URL(`/api/collections/${this.collectionName}/records`, this.opts.serverUrl);
    const response = await this.opts.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to getFullList`, { cause: response });
    }
    return response.json();
  }

  async schema() {
    const url = new URL(`/api/collections/${this.collectionName}`, this.opts.serverUrl);
    const response = await this.opts.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to schema`, { cause: response });
    }
    return response.json();
  }

  getOne() {
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
