import type Server from '../../experiments/lib/server';

export class FakeNetwork {
  private addresses = {};

  register(hostName: string, server: Server) {
    this.addresses[hostName] = server;
  }

  fetch = (...args: ConstructorParameters<typeof Request>) => {
    const request = new Request(...args);
    const url = new URL(request.url);

    let target = this.addresses[url.origin];

    return target.handleRequest(request);
  };
}
