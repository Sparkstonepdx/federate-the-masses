import { FindOptions, RecordData } from '../../server/lib/store';
import { Fetch } from '../../shared/types';
import { generateURN } from '../../shared/urn';

interface CollectionOpts {
  cache: Map<string, string>;
  fetch: Fetch;
  serverUrl: string;
}

export class Collection<CollectionData extends RecordData> {
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

    return records;
  }

  async schema() {
    const url = new URL(`/api/collections/${this.collectionName}`, this.opts.serverUrl);
    const response = await this.opts.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to schema`, { cause: response });
    }
    return response.json();
  }

  async findOne(options: FindOptions = {}) {
    options.perPage = 1;

    return await this.find(options);
  }

  async create(data: Partial<CollectionData> = {}) {
    const now = new Date().toISOString();
    data.id = generateURN(this.collectionName, this.opts.serverUrl);
    data.created_at ??= now;
    data.modified_at ??= data.created_at;
    data.host = this.opts.serverUrl;

    const url = new URL(`/api/collections/${this.collectionName}/records`, this.opts.serverUrl);

    const formData = new FormData();
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        formData.append(key, data[key]);
      }
    }

    const response = await this.opts.fetch(url, { method: 'post', body: formData });
    if (!response.ok) {
      throw new Error('Failed to create record', { cause: response });
    }

    return response.json();
  }

  async upsert(data: CollectionData) {
    const now = new Date().toISOString();
    data.id ??= generateURN(this.collectionName, this.opts.serverUrl);
    data.created_at ??= now;
    data.modified_at = now;
    data.host = this.opts.serverUrl;

    const url = new URL(
      `/api/collections/${this.collectionName}/records/${encodeURIComponent(data.id)}`,
      this.opts.serverUrl
    );

    const formData = new FormData();
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        formData.append(key, data[key]);
      }
    }

    const response = await this.opts.fetch(url, { method: 'PUT', body: formData });
    if (!response.ok) {
      throw new Error('Failed to upsert record', { cause: response });
    }

    return response.json();
  }

  async update(id: string, data: Partial<CollectionData>) {
    const now = new Date().toISOString();
    data.created_at ??= now;
    data.modified_at = now;

    const url = new URL(
      `/api/collections/${this.collectionName}/records/${encodeURIComponent(id)}`,
      this.opts.serverUrl
    );

    const formData = new FormData();
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        formData.append(key, data[key]);
      }
    }

    const response = await this.opts.fetch(url, { method: 'PATCH', body: formData });
    if (!response.ok) {
      throw new Error('Failed to update record', { cause: response });
    }

    return response.json();
  }

  async delete(id: string) {
    const url = new URL(
      `/api/collections/${this.collectionName}/records/${encodeURIComponent(id)}`,
      this.opts.serverUrl
    );

    const response = await this.opts.fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to delete record', { cause: response });
    }
  }

  subscribe() {
    throw new Error('not implemented');
  }
}
