import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Router } from '@vaadin/router';
import base from './baseStyles';
import './components/feather-icon';
import './components/nav-bar';
import { routerContext, routes } from './routes/route-config';

@customElement('etch-app')
export class EtchApp extends LitElement {
    @provide({ context: routerContext })
    private router: Router = new Router();
    protected firstUpdated(): void {
        this.router.setOutlet(this.renderRoot?.querySelector('#outlet'));
        this.router.setRoutes(routes);
    }

    render() {
        return html`
            <main>
                <div id="outlet"></div>
            </main>
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
            }
        `,
    ];
}
