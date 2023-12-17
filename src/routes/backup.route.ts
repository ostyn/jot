import { css, html, LitElement } from 'lit';
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
    gdrive = new GoogleDriveService();
    auth = async () => {
        this.gdrive.authenticate(this.checkForToken);
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

    // TODO(developer): Set to client ID and API key from the Developer Console

    CLIENT_ID!: string;
    API_KEY!: string;

    // Discovery doc URL for APIs used by the quickstart
    DISCOVERY_DOC =
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

    // Authorization scopes required by the API; multiple scopes can be
    // included, separated by spaces.
    SCOPES =
        'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile';

    /**
     * Callback after api.js is loaded.
     */
    gapiLoaded = async () => {
        window.gapi.load('client', this.initializeGapiClient);
    };

    /**
     * Callback after the API client is loaded. Loads the
     * discovery doc to initialize the API.
     */
    initializeGapiClient = async () => {
        await window.gapi.client.init({
            apiKey: this.API_KEY,
            discoveryDocs: [this.DISCOVERY_DOC],
        });
    };

    /**
     * Callback after Google Identity Services are loaded.
     */
    gisLoaded = () => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: this.checkForToken,
        });
        this.gdrive.init(tokenClient);
    };

    someHTML: any;
    protected async firstUpdated() {
        this.CLIENT_ID = import.meta.env.VITE_GCLIENT_ID;
        this.API_KEY = import.meta.env.VITE_GAPI_KEY;

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.onload = this.gapiLoaded;
        script.src = 'https://apis.google.com/js/api.js';
        document.getElementsByTagName('head')[0].appendChild(script);
        const script2 = document.createElement('script');
        script2.type = 'text/javascript';
        script2.async = true;
        script2.onload = this.gisLoaded;
        script2.src = 'https://accounts.google.com/gsi/client';
        document.getElementsByTagName('head')[0].appendChild(script2);

        this.checkForToken();
    }
    checkForToken = async () => {
        if (this.gdrive.hasValidToken()) {
            this.userInfo = await this.gdrive.getUserInfo();
            this.backups = await this.gdrive.listFolder();
        }
    };
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
                              <feather-icon
                                  name=${ifDefined(
                                      this.isLoading ? undefined : 'refresh-cw'
                                  )}
                              ></feather-icon>
                              Manual Backup
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
                            <feather-icon
                                name=${ifDefined(
                                    this.isDeletingId[backup.id]
                                        ? undefined
                                        : 'copy'
                                )}
                            ></feather-icon>
                            Restore
                        </button>
                        <button
                            @click=${() => this.delete(backup.id)}
                            aria-busy=${ifDefined(this.isDeletingId[backup.id])}
                            class="inline iconButton"
                        >
                            <feather-icon
                                name=${ifDefined(
                                    this.isDeletingId[backup.id]
                                        ? undefined
                                        : 'trash'
                                )}
                            ></feather-icon>
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
