import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { RouteConfig, Router } from '@lit-labs/router';
import { provide } from '@lit/context';
import base from './baseStyles';
import './components/feather-icon';
import './components/nav-bar';
import { routerContext } from './router-context';
import { ActivitiesRoute } from './routes/activities.route';
import { EntriesRoute } from './routes/entries.route';
import { EntryRoute } from './routes/entry.route';
import { MoodsRoute } from './routes/moods.route';
import { SettingsRoute } from './routes/settings.route';

@customElement('etch-app')
export class EtchApp extends LitElement {
    @provide({ context: routerContext })
    public router = new Router(this, [
        {
            path: '/',
            name: 'home',
            render: EntriesRoute.routeRender,
        },
        {
            path: '/entries',
            name: 'Entries',
            menuItem: true,
            iconName: 'book-open',
            render: EntriesRoute.routeRender,
        },
        {
            path: '/moods',
            name: 'moods',
            menuItem: true,
            iconName: 'smile',
            render: MoodsRoute.routeRender,
        },
        {
            path: '/activities',
            name: 'activities',
            menuItem: true,
            iconName: 'activity',
            render: ActivitiesRoute.routeRender,
        },
        {
            path: '/entry',
            name: 'entry',
            iconName: 'edit-3',
            render: EntryRoute.routeRender,
        },
        {
            path: '/settings',
            name: 'settings',
            menuItem: true,
            iconName: 'settings',
            render: SettingsRoute.routeRender,
        },
    ] as RouteConfig[]);

    render() {
        return html`
            <main>${this.router.outlet()}</main>
            <nav-bar></nav-bar>
        `;
    }
    static styles = [base];
}
