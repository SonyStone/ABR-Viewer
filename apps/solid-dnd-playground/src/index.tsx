/* @refresh reload */
import { Route, Router } from '@solidjs/router';
import { lazy } from 'solid-js';
import { render } from 'solid-js/web';
import App from './App';
import './styles.css';

// Lazy-loaded demo routes for code-splitting
const SensorDemo = lazy(() => import('./demos/SensorDemo'));
const ListDemo = lazy(() => import('./demos/ListDemo'));
const GridDemo = lazy(() => import('./demos/GridDemo'));
const ListOverlayDemo = lazy(() => import('./demos/ListOverlayDemo'));
const GridOverlayDemo = lazy(() => import('./demos/GridOverlayDemo'));
const NestedDemo = lazy(() => import('./demos/NestedDemo'));
const NestedOverlayDemo = lazy(() => import('./demos/NestedOverlayDemo'));

const root = document.getElementById('app');
if (!root) throw new Error('Root element not found');

render(
  () => (
    <Router root={App}>
      <Route path={['/', '/sensor']} component={SensorDemo} />
      <Route path="/list" component={ListDemo} />
      <Route path="/grid" component={GridDemo} />
      <Route path="/list-overlay" component={ListOverlayDemo} />
      <Route path="/grid-overlay" component={GridOverlayDemo} />
      <Route path="/nested" component={NestedDemo} />
      <Route path="/nested-overlay" component={NestedOverlayDemo} />
    </Router>
  ),
  root
);
