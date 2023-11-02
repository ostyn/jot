import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';

@customElement('import-route')
export class ImportRoute extends LitElement {
    render() {
        return html`<article>Import</article>`;
    }
    static styles = [base];
}
