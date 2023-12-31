import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { Router } from '@vaadin/router';
import { format } from 'date-fns';
import { base } from '../baseStyles';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { settings } from '../stores/settings.store';

@customElement('settings-route')
export class SettingsRoute extends MobxLitElement {
    sub: any;
    exportBackup() {
        if (confirm('Download complete backup file of all personal data?')) {
            const backupEntries = entries.all.map((entry) => {
                const newEntry: any = { ...entry };
                delete newEntry.dateObject;
                return newEntry;
            });
            this.download(
                `Jot Backup ${format(
                    new Date(),
                    'yyyy-dd-MM @ HH.mm.ss'
                )}.json`,
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
                <h2>General</h2>
                <div class="settings-column">
                    <label class="inline"
                        ><input
                            .checked=${settings.isDark}
                            type="checkbox"
                            role="switch"
                            @change=${() =>
                                settings.setIsDark(!settings.isDark)}
                        />
                        Dark Mode
                    </label>
                    <label class="inline"
                        ><input
                            .checked=${settings.showArchived}
                            type="checkbox"
                            role="switch"
                            @change=${() =>
                                settings.setShowArchived(
                                    !settings.showArchived
                                )}
                        />
                        Show Archived Activities
                    </label>
                </div>
            </section>
            <section>
                <h2>Data</h2>
                <button @click=${() => Router.go('backup')}>
                    <jot-icon name="UploadCloud"></jot-icon>Cloud Backup
                </button>

                <div class="settings-row">
                    <button @click=${this.exportBackup}>
                        <jot-icon name="Share"></jot-icon>Export Backup
                    </button>
                    <button @click=${() => Router.go('import')}>
                        <jot-icon name="Import"></jot-icon>Import Backup
                    </button>
                </div>
                <button @click=${() => Router.go('import-daylio')}>
                    <jot-icon name="SmilePlus"></jot-icon>Import from Daylio
                </button>
                <button class="secondary" @click=${this.resetAll}>
                    <jot-icon name="Trash2"></jot-icon>Wipe Data
                </button>
            </section>
        </article>`;
    }
    resetAll() {
        if (
            confirm(
                'Are you sure you want to delete all your data? This cannot be reversed without a valid backup.'
            )
        ) {
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
            .settings-row,
            .settings-column {
                display: flex;
                gap: 0.75rem;
            }
            .settings-column {
                flex-direction: column;
            }
        `,
    ];
}
