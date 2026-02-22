/* @refresh reload */
import { Route, Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import App from './App';
import GridDemo from './demos/GridDemo';
import GridOverlayDemo from './demos/GridOverlayDemo';
import ListDemo from './demos/ListDemo';
import ListOverlayDemo from './demos/ListOverlayDemo';
import NestedDemo from './demos/NestedDemo';
import NestedOverlayDemo from './demos/NestedOverlayDemo';
import SensorDemo from './demos/SensorDemo';
import './styles.css';

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
