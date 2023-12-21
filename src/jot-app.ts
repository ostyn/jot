import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Router } from '@vaadin/router';
import { registerSW } from 'virtual:pwa-register';
import { base } from './baseStyles';
import './components/action-sheets/action-sheet.component';
import './components/jot-icon';
import './components/nav-bar';
import { routerContext, routes } from './routes/route-config';

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
        this.router.setOutlet(this.renderRoot?.querySelector('#outlet'));
        this.router.setRoutes(routes);
    }

    render() {
        return html`
            <main>
                <div id="outlet"></div>
            </main>
            <action-sheet></action-sheet>
            <nav-bar></nav-bar>
        `;
    }
    static styles = [
        base,
        css`
            #outlet {
                display: block;
                max-width: 36rem;
                margin: auto;
                padding-bottom: 4rem;
            }
        `,
    ];
}
