import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import base from '../baseStyles';

@customElement('settings-route')
export class SettingsRoute extends LitElement {
    render() {
        return html`Settings`;
    }
    static routeRender() {
        return html`<settings-route></settings-route>`;
    }
    static styles = [base];
}
