import { createContext } from '@lit/context';
import { Route, Router } from '@vaadin/router';
import { JotIconName } from '../components/jot-icon';
import './activities.route';
import './backup.route';
import './entries.route';
import './entry-edit.route';
import './import-daylio.route';
import './import.route';
import './moods.route';
import './search.route';
import './settings.route';

export const routerContext = createContext<Router>('router');
export const routes = [
    {
        path: '/entries',
        component: 'entries-route',
        name: 'entries',
        options: { menuItem: true, iconName: 'BookOpen' },
    },
    {
        path: '/moods',
        component: 'moods-route',
        name: 'moods',
        options: { menuItem: true, iconName: 'Smile' },
    },
    {
        path: '/activities',
        component: 'activities-route',
        name: 'activities',
        options: { menuItem: true, iconName: 'Activity' },
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
        options: { menuItem: true, iconName: 'Settings' },
    },
    {
        path: '/import-daylio',
        component: 'import-daylio-route',
        name: 'import-daylio',
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
    {
        path: '/backup',
        component: 'backup-route',
        name: 'backup',
    },
] as const satisfies JotRoute[];
type RouteName = (typeof routes)[number]['name'];
export type JotRoute = Route & {
    options?: { iconName?: JotIconName; menuItem?: boolean };
};
export function go(
    route: RouteName,
    options?: { pathParams?: string[]; queryParams?: any }
) {
    let pathParamsText = '';
    if (options?.pathParams?.length)
        pathParamsText = `/${options.pathParams.join('/')}`;
    if (options?.queryParams) {
        const queryParams = new URLSearchParams(options.queryParams).toString();
        Router.go(`${route}${pathParamsText}?${queryParams}`);
    } else {
        Router.go(`${route}${pathParamsText}`);
    }
}
