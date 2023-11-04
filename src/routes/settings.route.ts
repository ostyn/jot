import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { settings } from '../stores/settings.store';

@customElement('settings-route')
export class SettingsRoute extends MobxLitElement {
    sub: any;
    render() {
        return html`<article>
            <label class="inline"
                ><input
                    .checked=${settings.isDark}
                    type="checkbox"
                    role="switch"
                    @change=${() => settings.setIsDark(!settings.isDark)}
                />
                ${settings.isDark ? 'Dark' : 'Light'} Mode
            </label>
        </article>`;
    }
    static styles = [base];
}
