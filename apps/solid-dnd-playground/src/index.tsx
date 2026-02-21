/* @refresh reload */
import { Route, Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import App from './App';
import GridDemo from './demos/GridDemo';
import ListDemo from './demos/ListDemo';
import NestedDemo from './demos/NestedDemo';
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
      <Route path="/nested" component={NestedDemo} />
    </Router>
  ),
  root
);
