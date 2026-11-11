// plotagents · entrada mínima para la página de dashboard(): la de toHTML()
// más el montaje del tablero (filtros y KPIs que se recalculan).
import { plot, resolve, withDefaults } from './base.js';
import { mountDashboard, renderDashboard, _bindDashboard } from './dashboard.js';

_bindDashboard({ plot, resolve, resolveDefaults: withDefaults });

export * from './page.js';
export { mountDashboard, renderDashboard };
