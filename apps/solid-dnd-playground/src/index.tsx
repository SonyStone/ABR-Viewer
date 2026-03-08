/* @refresh reload */
import { Route, Router } from '@solidjs/router';
import { lazy } from 'solid-js';
import { render } from 'solid-js/web';
import App from './App';
import './styles.css';

// Lazy-loaded demo routes for code-splitting
const SensorDemo = lazy(() => import('./demos/SensorDemo'));
const SortableOverlayDemo = lazy(() => import('./demos/SortableOverlayDemo'));
const NestedDemo = lazy(() => import('./demos/NestedDemo'));
const NestedOverlayDemo = lazy(() => import('./demos/NestedOverlayDemo'));

const root = document.getElementById('app');
if (!root) throw new Error('Root element not found');

render(
  () => (
    <Router root={App}>
      <Route path={['/', '/sensor']} component={SensorDemo} />
      <Route path="/sortable-overlay" component={SortableOverlayDemo} />
      <Route path="/nested" component={NestedDemo} />
      <Route path="/nested-overlay" component={NestedOverlayDemo} />
    </Router>
  ),
  root
);
