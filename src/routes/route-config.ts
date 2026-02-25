import { createContext } from '@lit/context';
import { Route, Router } from '@vaadin/router';
import '../components/action-sheets/map.sheet';
import { JotIconName } from '../components/jot-icon';
import './activities.route';
import './activity-detail-edit.route';
import './backup.route';
import './cycle-station.route';
import './cycle.route';
import './entries.route';
import './entry-edit.route';
import './game.route';
import './import-daylio.route';
import './import.route';
import './mood-edit.route';
import './moods.route';
import './note-edit.route';
import './notes.route';
import './search.route';
import './settings.route';
import './summary.route';
import './today.route';

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
        children: [
            {
                name: 'mood-edit',
                path: '/edit/:id?',
                component: 'mood-edit-route',
            },
        ],
    },
    {
        path: '/activities',
        component: 'activities-route',
        name: 'activities',
        options: { menuItem: true, iconName: 'Activity' },
    },
    {
        path: '/notes',
        component: 'notes-route',
        name: 'notes',
        options: { menuItem: true, iconName: 'StickyNote' },
        children: [
            {
                name: 'note-edit',
                path: '/edit/:id?',
                component: 'note-edit-route',
            },
        ],
    },
    {
        path: '/cycle',
        component: 'cycle-route',
        name: 'cycle',
        children: [
            {
                name: 'cycle-station',
                path: '/:id',
                component: 'cycle-station-route',
            },
        ],
    },
    {
        path: '/',
        component: 'entries-route',
        name: 'entries',
    },
    {
        path: '/entry',
        redirect: '/entry/new',
    },
    {
        path: '/entry/:id',
        component: 'entry-edit-route',
        name: 'entry',
        children: [
            {
                name: 'activity-detail-edit',
                path: '/activity/:activityId',
                component: 'activity-edit-detail-route',
            },
        ],
    },
    {
        path: '/summary/:start?/:end?',
        component: 'summary-route',
        name: 'summary',
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
    {
        path: '/game',
        component: 'game-route',
        name: 'game',
    },
    {
        path: '/today',
        component: 'today-route',
        name: 'today',
    },
] as const satisfies JotRoute[];

type ExtractRouteNames<T> = T extends { name: infer N; children?: infer C }
    ? N | (C extends readonly Route[] ? ExtractRouteNames<C[number]> : never)
    : never;

type RouteName = ExtractRouteNames<(typeof routes)[number]>;

export type JotRoute = Route & {
    options?: {
        iconName?: JotIconName;
        menuItem?: boolean;
    };
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

export function findRoute(
    routes: readonly JotRoute[],
    routeName: RouteName,
    parentPath = ''
): { route: JotRoute; fullPath: string } | undefined {
    for (const r of routes) {
        const fullPath = `${parentPath}${r.path}`.replace(/\/+/g, '/');

        if (r.name === routeName) {
            return { route: r, fullPath };
        }

        if (r.children && Array.isArray(r.children)) {
            const found = findRoute(r.children, routeName, fullPath);
            if (found) return found;
        }
    }
    return undefined;
}

export function betterGo(
    routeName: RouteName,
    options?: {
        pathParams?: Record<string, string | number>;
        queryParams?: Record<string, string | number | boolean | undefined>;
    }
) {
    const result = findRoute(routes, routeName);

    if (!result) {
        console.error(`Route with name "${routeName}" not found`);
        return;
    }

    let path = result.fullPath;

    // Replace path params (:id, :id?)
    if (options?.pathParams) {
        for (const [key, value] of Object.entries(options.pathParams)) {
            path = path.replace(
                new RegExp(`:${key}\\??`),
                encodeURIComponent(String(value))
            );
        }
    }

    // Remove unresolved optional params
    path = path.replace(/\/?:\w+\?/g, '');

    // Append query params
    if (options?.queryParams) {
        const search = new URLSearchParams(
            Object.entries(options.queryParams)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
        ).toString();

        if (search) path += `?${search}`;
    }

    Router.go(path);
}
