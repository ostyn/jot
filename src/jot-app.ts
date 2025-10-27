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
import { routerContext, routes } from './routes/route-config';
import { settings } from './stores/settings.store';

@customElement('jot-app')
export class JotApp extends LitElement {
    @state()
    sheet = 'other';
    @state()
    hide: boolean = false;
    @provide({ context: routerContext })
    private router: Router = new Router();
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
        window.addEventListener('vaadin-router-location-changed', () => {
            if (Sheet.isShown) {
                Sheet.close();
            } else {
                window.dispatchEvent(new CustomEvent('jot-navigate'));
            }
        });
    }

    render() {
        return html`
            <main id="main">
                <div id="outlet"></div>
            </main>
            <action-sheet></action-sheet>
            <nav-bar></nav-bar>
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
                padding-bottom: 12rem;
                width: calc(100% - 2rem);
                margin: 1rem;
                margin-top: 0;
            }
        `,
    ];
}
