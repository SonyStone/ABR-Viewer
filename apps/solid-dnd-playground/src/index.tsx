/* @refresh reload */
import { Route, Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import App, { GridDemo, ListDemo, NestedDemo } from './App';
import './styles.css';

const root = document.getElementById('app');
if (!root) throw new Error('Root element not found');

render(
  () => (
    <Router root={App}>
      <Route path={['/', '/list']} component={ListDemo} />
      <Route path="/grid" component={GridDemo} />
      <Route path="/nested" component={NestedDemo} />
    </Router>
  ),
  root
);
