import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { ImportDaylio } from './ImportDaylio';

@customElement('import-daylio-route')
export class ImportDaylioRoute extends LitElement {
    public csv = '';
    @state()
    public moodsToMap: string[] = [];
    @state()
    public activitiesToMap: string[] = [];
    @state()
    public entries: Entry[] = [];
    @state()
    public moodMappings: { [n: string]: string } = {};
    @state()
    public activityMappings: { [n: string]: string } = {};
    @state()
    unassignedMoods: number = 0;
    @state()
    unassignedActivities: number = 0;
    onBeforeLeave(_location: any, commands: any, _router: any) {
        if (this.entries.length && !confirm('Lose unsaved changes?')) {
            return commands.prevent();
        }
    }
    private parse(): void {
        let resp = ImportDaylio.parseCsv(
            this.csv,
            this.moodMappings,
            this.activityMappings
        );
        this.entries = resp.entries;
        this.moodsToMap = resp.moodsToMap;
        this.activitiesToMap = resp.activitiesToMap;
        this.unassignedActivities = this.activitiesToMap.filter(
            (mapping) => this.activityMappings[mapping] === undefined
        ).length;
        this.unassignedMoods = this.moodsToMap.filter(
            (mapping) => this.moodMappings[mapping] === undefined
        ).length;
    }
    private import(): void {
        this.entries.forEach((entry) => {
            entries.insertEntry(entry);
        });
    }
    private getMood(moodId: string): Mood | undefined {
        return moods.getMood(moodId);
    }
    private getActivity(activityId: string): Activity | undefined {
        return activities.getActivity(activityId);
    }
    private openMoodPrompt(mood: any, original: any): void {
        ActionSheetController.open({
            type: 'mood',
            data: mood,
            onSubmit: (data) => {
                this.moodMappings[original] = data;
                this.parse();
            },
        });
    }
    private openActivityPrompt(activity: any, original: any): void {
        ActionSheetController.open({
            type: 'activity',
            data: activity,
            onSubmit: (data) => {
                this.activityMappings[original] = data;
                this.parse();
            },
        });
    }
    handleFile() {
        const fileInput = this.shadowRoot?.getElementById('fileInput');
        const file = (fileInput as any).files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (file.type === 'text/csv') {
                    this.csv = event.target?.result as string;
                    this.parse();
                }
            };
            reader.readAsText(file);
        } else {
            console.log('No file selected');
        }
    }
    render() {
        return html`<article>
                <header>Import</header>
                <input
                    @change=${this.handleFile}
                    id="fileInput"
                    type="file"
                    accept=".csv"
                />
                <button
                    .disabled=${!this.entries.length ||
                    this.unassignedActivities > 0 ||
                    this.unassignedMoods > 0}
                    @click=${this.import}
                >
                    import
                </button>
            </article>
            <article>
                <hgroup>
                    <h2>Moods</h2>
                    <h3>
                        ${this.unassignedMoods
                            ? html`${this.unassignedMoods} remaining`
                            : nothing}
                    </h3>
                </hgroup>
                ${this.moodsToMap.map(
                    (mood) =>
                        html`<span
                            class=${'mood-mappings ' +
                            (this.moodMappings[mood] ? 'mapped' : '')}
                            @click=${() =>
                                this.openMoodPrompt(
                                    this.moodMappings[mood],
                                    mood
                                )}
                        >
                            ${mood}
                            <feather-icon name="arrow-right"></feather-icon>
                            ${this.moodMappings[mood]
                                ? html`
                                      ${this.getMood(this.moodMappings[mood])
                                          ?.emoji}
                                  `
                                : html`<feather-icon
                                      name="alert-triangle"
                                  ></feather-icon>`}
                        </span>`
                )}
            </article>
            <article>
                <hgroup>
                    <h2>Activities</h2>
                    <h3>
                        ${this.unassignedActivities
                            ? `${this.unassignedActivities} remaining`
                            : nothing}
                    </h3>
                </hgroup>
                ${this.activitiesToMap.map(
                    (activity) =>
                        html`<span
                            class=${'activity-mappings ' +
                            (this.activityMappings[activity] ? 'mapped' : '')}
                            @click=${() =>
                                this.openActivityPrompt(
                                    this.activityMappings[activity],
                                    activity
                                )}
                        >
                            ${activity}
                            <feather-icon name="arrow-right"></feather-icon>
                            ${this.activityMappings[activity]
                                ? html`
                                      ${this.getActivity(
                                          this.activityMappings[activity]
                                      )?.emoji}
                                  `
                                : html`<feather-icon
                                      name="alert-triangle"
                                  ></feather-icon>`}
                        </span>`
                )}
            </article>
            <article>
                <header>Preview</header>
                ${this.entries.map(
                    (e) =>
                        html`<entry-component
                            class="import-entry"
                            .entry=${e}
                        ></entry-component>`
                )}
            </article>`;
    }
    static styles = [
        base,
        css`
            .mood-mappings,
            .activity-mappings {
                padding: 0.25rem;
                margin: 0.25rem;
                cursor: pointer;
                border: var(--del-color) 1px solid;
                border-radius: 12px;
                display: inline-flex;
                align-content: center;
                gap: 4px;
            }
            .mapped {
                border-color: var(--ins-color);
                background-color: var(--ins-color);
                color: var(--contrast);
            }
        `,
    ];
}
