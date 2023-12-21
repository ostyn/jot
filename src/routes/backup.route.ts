import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { animate } from '@lit-labs/motion';
import { format, parseISO } from 'date-fns';
import { base } from '../baseStyles';
import '../components/calendar-wrapper.component';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { GoogleDriveService } from '../services/google-drive.service';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

@customElement('backup-route')
export class BackupRoute extends LitElement {
    @state()
    userInfo?: { name: string; picture: string };
    @state()
    backups: { id: string; description: string; createdTime: string }[] = [];
    @state()
    isDeletingId: any = {};
    @state()
    isLoading = false;
    gdrive = new GoogleDriveService(this.checkForToken.bind(this));

    auth = async () => {
        this.gdrive.authenticate(this.checkForToken.bind(this));
    };
    sync = async () => {
        this.isLoading = true;
        await this.gdrive.addFile(
            'Backup.json',
            JSON.stringify({
                entries: entries.all,
                activities: activities.all,
                moods: moods.userCreated,
            }),
            `Entries: ${entries.all.length}, Activities: ${activities.all.length}, Moods: ${moods.userCreated.length}`
        );
        this.backups = await this.gdrive.listFolder();
        this.isLoading = false;
    };
    delete = async (id: string) => {
        this.isDeletingId = { ...this.isDeletingId, [id]: true };
        await this.gdrive.deleteFile(id);
        this.backups = await this.gdrive.listFolder();
    };

    protected async firstUpdated() {
        this.checkForToken();
    }
    private async checkForToken() {
        if (this.gdrive.hasValidToken()) {
            this.userInfo = await this.gdrive.getUserInfo();
            this.backups = await this.gdrive.listFolder();
        }
    }
    render() {
        return html` <article>
            <header>
                ${this.userInfo
                    ? html`${this.userInfo?.name}
                          <img src=${this.userInfo?.picture} />
                          <button
                              class="inline iconButton"
                              @click=${this.sync}
                              aria-busy=${ifDefined(this.isLoading)}
                          >
                              ${!this.isLoading
                                  ? html`<jot-icon
                                        name="UploadCloud"
                                    ></jot-icon>`
                                  : nothing}
                              Backup
                          </button>`
                    : html`<button
                          @click=${this.auth}
                          aria-busy=${ifDefined(this.isLoading)}
                      >
                          Authenticate with Google
                      </button>`}
            </header>
            ${this.backups.map(
                (backup) =>
                    html`<article
                        ${animate({
                            in: [
                                {
                                    transform: 'translateY(-100%)',
                                },
                            ],
                            out: [
                                {
                                    transform: 'translateY(-100%)',
                                },
                            ],
                        })}
                        class="backup"
                    >
                        <hgroup>
                            <h3>${backup.description}</h3>
                            <h4>
                                ${format(
                                    new Date(backup.createdTime),
                                    'yyyy-MM-dd@HH:mm'
                                )}
                            </h4>
                        </hgroup>
                        <button
                            @click=${() => this.restore(backup)}
                            aria-busy=${ifDefined(this.isDeletingId[backup.id])}
                            class="inline iconButton"
                        >
                            ${!this.isDeletingId[backup.id]
                                ? html`<jot-icon
                                      name="DownloadCloud"
                                  ></jot-icon>`
                                : nothing}
                            Restore
                        </button>
                        <button
                            @click=${() => this.delete(backup.id)}
                            aria-busy=${ifDefined(this.isDeletingId[backup.id])}
                            class="inline iconButton"
                        >
                            ${!this.isDeletingId[backup.id]
                                ? html`<jot-icon name="Trash"></jot-icon>`
                                : nothing}
                            Delete
                        </button>
                    </article>`
            )}
        </article>`;
    }
    async restore(file: any) {
        if (
            confirm(
                `WARNING: All existing data will be lost. This will restore all content to the backup made on ${format(
                    new Date(file.createdTime),
                    'yyyy-MM-dd@HH:mm'
                )}. Continue?`
            )
        ) {
            const resp = await this.gdrive.getFile(file.id);
            const newEntries = resp.result.entries;
            const newActivities = resp.result.activities;
            const newMoods = resp.result.moods;

            newEntries.forEach((entry: Entry) => {
                entry.created = parseISO(entry.created as unknown as string);
                entry.updated = parseISO(entry.updated as unknown as string);
                entry.dateObject = new Date(entry.date);
            });
            newMoods.forEach((mood: Mood) => {
                mood.created = parseISO(mood.created as unknown as string);
                mood.updated = parseISO(mood.updated as unknown as string);
            });
            newActivities.forEach((activity: Activity) => {
                activity.created = parseISO(
                    activity.created as unknown as string
                );
                activity.updated = parseISO(
                    activity.updated as unknown as string
                );
            });
            entries.reset();
            activities.reset();
            moods.reset();
            moods.bulkImport(newMoods);
            activities.bulkImport(newActivities);
            entries.bulkImport(newEntries);
        }
    }
    static styles = [
        base,
        css`
            header {
                display: flex;
                align-items: center;
                gap: 8px;
                justify-content: space-between;
            }
            .iconButton {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .backup {
                display: flex;
                align-items: center;
                gap: 8px;
                justify-content: space-between;
            }
            hgroup {
                margin: 0px;
            }
        `,
    ];
}
