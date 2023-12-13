import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { animate } from '@lit-labs/motion';
import { format } from 'date-fns';
import { base } from '../baseStyles';
import '../components/calendar-wrapper.component';
import { GoogleDriveService } from '../services/google-drive.service';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';

@customElement('backup-route')
export class BackupRoute extends LitElement {
    @state()
    isDeletingId: any = {};
    @state()
    isLoading = false;
    gdrive = new GoogleDriveService();
    auth = async () => {
        this.gdrive.authenticate(this.firstUpdated.bind(this));
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
        this.files = await this.gdrive.listFolder();
        this.isLoading = false;
    };
    delete = async (id: string) => {
        this.isDeletingId = { ...this.isDeletingId, [id]: true };
        await this.gdrive.deleteFile(id);
        this.files = await this.gdrive.listFolder();
    };
    @state()
    userInfo: { name: string; picture: string };
    @state()
    files = [];
    protected async firstUpdated() {
        if (this.gdrive.hasValidToken()) {
            this.userInfo = await this.gdrive.getUserInfo();
            this.files = await this.gdrive.listFolder();
        }
    }
    render() {
        return html`<article>
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
            ${this.files.map(
                (file) =>
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
                            <h3>${file.description}</h3>
                            <h4>
                                ${format(
                                    new Date(file.createdTime),
                                    'yyyy-MM-dd@HH:mm'
                                )}
                            </h4>
                        </hgroup>
                        <button
                            aria-busy=${ifDefined(this.isDeletingId[file.id])}
                            class="inline iconButton"
                        >
                            <feather-icon
                                name=${ifDefined(
                                    this.isDeletingId[file.id]
                                        ? undefined
                                        : 'copy'
                                )}
                            ></feather-icon>
                            Restore
                        </button>
                        <button
                            @click=${() => this.delete(file.id)}
                            aria-busy=${ifDefined(this.isDeletingId[file.id])}
                            class="inline iconButton"
                        >
                            <feather-icon
                                name=${ifDefined(
                                    this.isDeletingId[file.id]
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
