import { createContext } from '@lit/context';
import { Route, Router } from '@vaadin/router';
import '../components/action-sheets/map.sheet';
import { JotIconName } from '../components/jot-icon';

const lazy = (loader: () => Promise<unknown>) => async () => {
    await loader();
};

export const routerContext = createContext<Router>('router');
export const routes = [
    {
        path: '/entries',
        component: 'entries-route',
        name: 'entries',
        action: lazy(() => import('./entries.route')),
        options: { menuItem: true, iconName: 'BookOpen' },
    },

    {
        path: '/moods',
        component: 'moods-route',
        name: 'moods',
        action: lazy(() => import('./moods.route')),
        options: { menuItem: true, iconName: 'Smile' },
        children: [
            {
                name: 'mood-edit',
                path: '/edit/:id?',
                component: 'mood-edit-route',
                action: lazy(() => import('./mood-edit.route')),
            },
        ],
    },
    {
        path: '/activities',
        component: 'activities-route',
        name: 'activities',
        action: lazy(() => import('./activities.route')),
        options: { menuItem: true, iconName: 'Activity' },
    },
    {
        path: '/notes',
        component: 'notes-route',
        name: 'notes',
        action: lazy(() => import('./notes.route')),
        options: { menuItem: true, iconName: 'StickyNote' },
        children: [
            {
                name: 'note-edit',
                path: '/edit/:id?',
                component: 'note-edit-route',
                action: lazy(() => import('./note-edit.route')),
            },
        ],
    },
    {
        path: '/reading',
        component: 'reading-route',
        name: 'reading',
        action: lazy(() => import('./reading.route')),
        options: { hideNavBar: true },
        children: [
            {
                name: 'reading-share',
                path: '/share',
                component: 'reading-route',
                action: lazy(() => import('./reading.route')),
            },
            {
                name: 'reading-item',
                path: '/:id',
                component: 'reading-route',
                action: lazy(() => import('./reading.route')),
            },
        ],
    },
    {
        path: '/cycle',
        component: 'cycle-route',
        name: 'cycle',
        action: lazy(() => import('./cycle.route')),
        options: { hideNavBar: true },
        children: [
            {
                name: 'cycle-station',
                path: '/:id',
                component: 'cycle-station-route',
                action: lazy(() => import('./cycle-station.route')),
            },
        ],
    },
    {
        path: '/',
        component: 'entries-route',
        name: 'entries',
        action: lazy(() => import('./entries.route')),
    },
    {
        path: '/entry/:id?',
        component: 'entry-edit-route',
        name: 'entry',
        action: lazy(() => import('./entry-edit.route')),
    },
    {
        path: '/summary/:start?/:end?',
        component: 'summary-route',
        name: 'summary',
        action: lazy(() => import('./summary.route')),
    },

    {
        path: '/settings',
        component: 'settings-route',
        name: 'settings',
        action: lazy(() => import('./settings.route')),
        options: { menuItem: true, iconName: 'Settings' },
    },
    {
        path: '/import-daylio',
        component: 'import-daylio-route',
        name: 'import-daylio',
        action: lazy(() => import('./import-daylio.route')),
    },
    {
        path: '/import',
        component: 'import-route',
        name: 'import',
        action: lazy(() => import('./import.route')),
    },
    {
        path: '/search',
        component: 'search-route',
        name: 'search',
        action: lazy(() => import('./search.route')),
    },
    {
        path: '/backup',
        component: 'backup-route',
        name: 'backup',
        action: lazy(() => import('./backup.route')),
    },
    {
        path: '/game',
        component: 'game-route',
        name: 'game',
        action: lazy(() => import('./game.route')),
        options: { hideNavBar: true },
    },
    {
        path: '/movie-faceoff/movie/:id',
        component: 'movie-faceoff-movie-route',
        name: 'movie-faceoff-movie',
        action: lazy(() => import('./movie-faceoff-movie.route')),
        options: { hideNavBar: true, wideOutlet: true },
    },
    {
        path: '/movie-faceoff/add',
        component: 'movie-faceoff-add-route',
        name: 'movie-faceoff-add',
        action: lazy(() => import('./movie-faceoff-add.route')),
        options: { hideNavBar: true, wideOutlet: true },
    },
    {
        path: '/movie-faceoff',
        component: 'movie-faceoff-route',
        name: 'movie-faceoff',
        action: lazy(() => import('./movie-faceoff.route')),
        options: { hideNavBar: true, wideOutlet: true },
    },
    {
        path: '/today',
        component: 'today-route',
        name: 'today',
        action: lazy(() => import('./today.route')),
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
        hideNavBar?: boolean;
        wideOutlet?: boolean;
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

export function shouldHideNavBar(pathname: string): boolean {
    return routes.some((route) => {
        const routeOptions = ('options' in route
            ? route.options
            : undefined) as JotRoute['options'] | undefined;
        if (!routeOptions?.hideNavBar) return false;
        if (route.path === pathname) return true;
        return route.path !== '/' && pathname.startsWith(`${route.path}/`);
    });
}

export function shouldUseWideOutlet(pathname: string): boolean {
    return routes.some((route) => {
        const routeOptions = ('options' in route
            ? route.options
            : undefined) as JotRoute['options'] | undefined;
        if (!routeOptions?.wideOutlet) return false;
        if (route.path === pathname) return true;
        return route.path !== '/' && pathname.startsWith(`${route.path}/`);
    });
}
