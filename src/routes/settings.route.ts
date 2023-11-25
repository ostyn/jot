import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { Router } from '@vaadin/router';
import { base } from '../baseStyles';
import { settings } from '../stores/settings.store';

@customElement('settings-route')
export class SettingsRoute extends MobxLitElement {
    sub: any;
    render() {
        return html`<article>
            <header>Settings</header>
            <section>
                <label class="inline"
                    ><input
                        .checked=${settings.isDark}
                        type="checkbox"
                        role="switch"
                        @change=${() => settings.setIsDark(!settings.isDark)}
                    />
                    ${settings.isDark ? 'Dark' : 'Light'} Mode
                </label>
            </section>
            <section>
                <button @click=${() => Router.go('import')}>
                    <feather-icon name="inbox"></feather-icon>import
                </button>
                <button click.trigger="export()">
                    <feather-icon name="archive"></feather-icon>export
                </button>
            </section>
        </article>`;
    }
    static styles = [
        base,
        css`
            button {
                display: inline-flex;
                place-content: center;
                align-items: center;
                gap: 8px;
            }
        `,
    ];
}
