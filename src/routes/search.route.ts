import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';

@customElement('search-route')
export class SearchRoute extends LitElement {
    render() {
        return html`<article>Search</article>`;
    }
    static styles = [base];
}
