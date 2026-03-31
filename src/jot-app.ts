import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Router } from '@vaadin/router';
import { registerSW } from 'virtual:pwa-register';
import { base } from './baseStyles';
import './components/action-sheets/action-sheet';
import { Sheet } from './components/action-sheets/action-sheet';
import './components/jot-icon';
import './components/nav-bar';
import {
    JotRoute,
    routerContext,
    routes,
    shouldHideNavBar,
    shouldUseWideOutlet,
} from './routes/route-config';
import { settings } from './stores/settings.store';

@customElement('jot-app')
export class JotApp extends LitElement {
    @state()
    sheet = 'other';
    @state()
    hide: boolean = false;
    @state()
    hideNavBar = false;
    @state()
    wideOutlet = false;
    @provide({ context: routerContext })
    private router: Router = new Router();

    private syncLayoutForRoute(pathname: string, activeRoute?: JotRoute) {
        this.hideNavBar =
            Boolean(activeRoute?.options?.hideNavBar) ||
            shouldHideNavBar(pathname);
        this.wideOutlet =
            Boolean(activeRoute?.options?.wideOutlet) ||
            shouldUseWideOutlet(pathname);
    }

    protected firstUpdated(): void {
        const updateSW = registerSW({
            onNeedRefresh() {
                if (confirm('Update available. Install now?')) updateSW();
            },
            onOfflineReady() {},
        });
        settings.setShowArchivedFromStorage();
        this.router.setOutlet(this.renderRoot?.querySelector('#outlet'));
        this.router.setRoutes(routes);
        this.syncLayoutForRoute(window.location.pathname);
        window.addEventListener('vaadin-router-location-changed', (event: any) => {
            const activeRoute = event.detail?.location?.routes?.at(-1) as
                | JotRoute
                | undefined;
            this.syncLayoutForRoute(
                event.detail?.location?.pathname || '/',
                activeRoute
            );
            if (Sheet.isShown) {
                Sheet.close();
            } else {
                window.dispatchEvent(new CustomEvent('jot-navigate'));
            }
        });
    }

    render() {
        return html`
            <main id="main" class=${this.hideNavBar ? 'nav-hidden' : ''}>
                <div id="outlet" class=${this.wideOutlet ? 'wide' : ''}></div>
            </main>
            <action-sheet></action-sheet>
            ${this.hideNavBar ? null : html`<nav-bar></nav-bar>`}
        `;
    }
    static styles = [
        base,
        css`
            #main {
                flex-direction: column;
                display: flex;
                align-items: center;
            }
            #outlet {
                display: block;
                max-width: 36rem;
                margin: auto;
                padding-bottom: 3rem;
                width: calc(100% - 2rem);
                margin: 1rem;
                margin-top: 0;
            }
            #outlet.wide {
                max-width: none;
                width: min(96rem, calc(100% - 2rem));
            }
            #main.nav-hidden #outlet {
                padding-bottom: 0;
            }
        `,
    ];
}
