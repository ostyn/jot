import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { base } from '../baseStyles';
import { Stores, storesContext } from '../stores/settings.store';

@customElement('settings-route')
export class SettingsRoute extends LitElement {
    @consume({ context: storesContext })
    @property({ attribute: false })
    stores!: Stores;
    @state()
    settings?: any;
    sub: any;

    firstUpdated() {
        this.settings = this.stores.settings.getState();
        this.sub = this.stores.settings.subscribe(
            (state) => (this.settings = state)
        );
    }

    render() {
        return html`<article>
            <label class="inline"
                ><input
                    .checked=${this.settings?.isDark}
                    type="checkbox"
                    role="switch"
                    @change=${() => this.settings.toggleDarkMode()}
                />
                ${this.settings?.isDark ? 'Dark' : 'Light'} Mode
            </label>
        </article>`;
    }
    static styles = [base];
}
