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
        const backupEntries = entries.all.map((entry) => {
            const newEntry: any = { ...entry };
            delete newEntry.dateObject;
            return newEntry;
        });
        this.download(
            `Jot Backup ${new Date().toUTCString()}.json`,
            JSON.stringify(
                {
                    entries: backupEntries,
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
                <header>General</header>
                <label class="inline"
                    ><input
                        .checked=${settings.isDark}
                        type="checkbox"
                        role="switch"
                        @change=${() => settings.setIsDark(!settings.isDark)}
                    />
                    Dark Mode
                </label>
                <hr />
                <label class="inline"
                    ><input
                        .checked=${settings.showArchived}
                        type="checkbox"
                        role="switch"
                        @change=${() =>
                            settings.setShowArchived(!settings.showArchived)}
                    />
                    Show Archived
                </label>
            </section>
            <section>
                <header>Backup</header>
                <button @click=${() => Router.go('backup')}>
                    <jot-icon name="Wrench"></jot-icon>Manage Backup
                </button>
            </section>
            <section>
                <header>Import</header>
                <button @click=${() => Router.go('import')}>
                    <jot-icon name="Inbox"></jot-icon>Import JSON
                </button>
                <button @click=${() => Router.go('import-daylio')}>
                    <jot-icon name="Inbox"></jot-icon>Import Daylio
                </button>
            </section>
            <section>
                <header>Export</header>
                <button @click=${this.exportBackup}>
                    <jot-icon name="Archive"></jot-icon>Export JSON
                </button>
            </section>
            <section>
                <header>Reset</header>
                <button class="secondary" @click=${this.resetAll}>
                    <jot-icon name="Trash"></jot-icon>Delete All
                </button>
            </section>
        </article>`;
    }
    resetAll() {
        if (confirm('Delete all data?')) {
            entries.reset();
            activities.reset();
            moods.reset();
        }
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
