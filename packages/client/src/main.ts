import { Fetch } from '../../shared/types';
import { Collection } from './collection';

interface ConstructorOptions {
  fetch?: any;
}

export default class Client<Schema> {
  private serverUrl: string;
  private fetch: Fetch;

  private cache: Map<string, string>;

  constructor(constructorOptions: Partial<ConstructorOptions> = {}) {
    this.fetch = constructorOptions.fetch ?? globalThis.fetch.bind(globalThis);
    this.cache = new Map();
  }

  setServer(url: string) {
    this.serverUrl = url;
  }

  async initialize() {
    // const url = new URL(`/api/collections`, this.serverUrl);
    // const response = await this.fetch(url);
    // if (!response.ok) {
    //   throw new Error(`Failed to initialize with server: "${this.serverUrl}"`, { cause: response });
    // }
    // const responseJson = await response.json();
    // console.log({ responseJson });
  }

  collection(collection: string) {
    return new Collection(collection, {
      cache: this.cache,
      fetch: this.fetch,
      serverUrl: this.serverUrl,
    });
  }
}
