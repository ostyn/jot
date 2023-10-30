import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Router } from '@vaadin/router';
import { base } from './baseStyles';
import { ActionSheetController } from './components/action-sheets/action-sheet-controller';
import './components/action-sheets/action-sheet.component';
import './components/feather-icon';
import './components/nav-bar';
import { routerContext, routes } from './routes/route-config';

@customElement('etch-app')
export class EtchApp extends LitElement {
    @state()
    sheet = 'other';
    @state()
    hide: boolean = false;
    @provide({ context: routerContext })
    private router: Router = new Router();
    protected firstUpdated(): void {
        this.router.setOutlet(this.renderRoot?.querySelector('#outlet'));
        this.router.setRoutes(routes);
    }

    render() {
        return html`
            <button @click=${() => ActionSheetController.open('other')}>
                EWOKS
            </button>
            <button @click=${() => ActionSheetController.open('mood')}>
                mood
            </button>
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
