import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { settings } from '../stores/settings.store';

@customElement('settings-route')
export class SettingsRoute extends LitElement {
    @state()
    settings: any = settings.getState();
    sub: any;

    firstUpdated() {
        settings.subscribe((state) => (this.settings = state));
    }

    render() {
        return html`<article>
            <label class="inline"
                ><input
                    .checked=${this.settings.isDark}
                    type="checkbox"
                    role="switch"
                    @change=${() => this.settings.toggleDarkMode()}
                />
                ${this.settings.isDark ? 'Dark' : 'Light'} Mode
            </label>
        </article>`;
    }
    static styles = [base];
}
