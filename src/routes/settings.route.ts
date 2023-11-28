import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { Router } from '@vaadin/router';
import { base } from '../baseStyles';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { settings } from '../stores/settings.store';

@customElement('settings-route')
export class SettingsRoute extends MobxLitElement {
    sub: any;
    exportBackup() {
        this.download(
            `Etch Backup ${new Date().toUTCString()}.json`,
            JSON.stringify(
                {
                    entries: entries.all,
                    activities: activities.all,
                    moods: moods.userCreated,
                },
                undefined,
                2
            )
        );
    }
    download(filename: string, text: string) {
        var element = document.createElement('a');
        element.setAttribute(
            'href',
            'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
        );
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }
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
                <header>Import</header>
                <button @click=${() => Router.go('import')}>
                    <feather-icon name="inbox"></feather-icon>JSON
                </button>
                <button @click=${() => Router.go('import-daylio')}>
                    <feather-icon name="inbox"></feather-icon>Daylio
                </button>
            </section>
            <section>
                <header>Export</header>
                <button @click=${this.exportBackup}>
                    <feather-icon name="archive"></feather-icon>JSON
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
