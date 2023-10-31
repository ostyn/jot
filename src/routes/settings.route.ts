import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { base } from '../baseStyles';
import {
    LocalSettingsService,
    localSettingsService,
} from '../services/localSettingsService';

@customElement('settings-route')
export class SettingsRoute extends LitElement {
    @state()
    isDark = true;
    @consume({ context: localSettingsService })
    @property({ attribute: false })
    localSettingsService!: LocalSettingsService;
    render() {
        return html`<article>
            <label class="inline"
                ><input
                    .checked=${this.localSettingsService.isDark}
                    type="checkbox"
                    role="switch"
                    @change=${() => this.localSettingsService.toggleNightMode()}
                />
                ${this.isDark ? 'Dark' : 'Light'} Mode
            </label>
        </article>`;
    }
    static styles = [base];
}
