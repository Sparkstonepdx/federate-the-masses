import { createSignal } from 'solid-js';
import './app.css';
import Client from '../../../../packages/client/src/main';
import { Route, Router, useSearchParams } from '@solidjs/router';

const client = new Client();

export default function App() {
  return (
    <Router>
      <Route path='/' component={BaseRoute} />
    </Router>
  );
}

function BaseRoute() {
  const [count, setCount] = createSignal(0);
  const [searchParams] = useSearchParams();

  client.setServer(searchParams['host']);

  return (
    <main>
      <h1>Hello world!</h1>
      <button class='increment' onClick={() => setCount(count() + 1)} type='button'>
        Clicks: {count()}
      </button>
      <p>
        Visit{' '}
        <a href='https://start.solidjs.com' target='_blank'>
          start.solidjs.com
        </a>{' '}
        to learn how to build SolidStart apps.
      </p>
    </main>
  );
}
