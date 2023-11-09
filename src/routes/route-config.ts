import { createContext } from '@lit/context';
import { Route, Router } from '@vaadin/router';
import { FeatherIconNames } from 'feather-icons';
import './activities.route';
import './entries.route';
import './entry-edit.route';
import './import.route';
import './moods.route';
import './search.route';
import './settings.route';

export const routerContext = createContext<Router>('router');
export const routes: Route[] = [
    {
        path: '/entries',
        component: 'entries-route',
        name: 'entries',
        options: { menuItem: true, iconName: 'book-open' },
    },
    {
        path: '/moods',
        component: 'moods-route',
        name: 'moods',
        options: { menuItem: true, iconName: 'smile' },
    },
    {
        path: '/activities',
        component: 'activities-route',
        name: 'activities',
        options: { menuItem: true, iconName: 'activity' },
    },
    {
        path: '/',
        component: 'entries-route',
        name: 'entries',
    },
    {
        path: '/entry/:id?',
        component: 'entry-edit-route',
        name: 'entry',
    },

    {
        path: '/settings',
        component: 'settings-route',
        name: 'settings',
        options: { menuItem: true, iconName: 'settings' },
    },
    {
        path: '/import',
        component: 'import-route',
        name: 'import',
    },
    {
        path: '/search',
        component: 'search-route',
        name: 'search',
    },
] as EtchRoute[];
export type EtchRoute = Route & {
    options?: { iconName?: FeatherIconNames; menuItem?: boolean };
};
