import { css, html, LitElement } from 'lit';
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

@customElement('import-route')
export class ImportRoute extends LitElement {
    public csv = `full_date,date,weekday,time,mood,activities,note_title,note
    2017-12-09,December 9,Saturday,01:25,rad,"shopping | 😉 | discussion...","","Choir concert and shopping"
    2017-12-08,December 8,Friday,01:26,rad,"friends | movies | good meal","","Hung out with Vaughn and Bethany. Went to Thai food. Watched fitzwilly"
    2017-12-07,December 7,Thursday,01:24,meh,"😶 | 😕","",""
    2017-12-06,December 6,Wednesday,01:24,good,"😶","",""`;
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

    private parse(): void {
        let resp = ImportDaylio.parseCsv(
            this.csv,
            this.moodMappings,
            this.activityMappings
        );
        this.entries = resp.entries;
        this.moodsToMap = resp.moodsToMap;
        this.activitiesToMap = resp.activitiesToMap;
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
    // private openActivityPrompt(activity, original): void {
    //     this.dialogService
    //         .open({
    //             viewModel: ActivityPromptDialog,
    //             model: activity,
    //         })
    //         .whenClosed((response) => {
    //             this.activityMappings[original] = response.output;
    //             this.parse();
    //         });
    // }
    render() {
        return html`<article>
                <header>Import Daylio CSV</header>
                <textarea
                    @change=${(e) => (this.csv = e.target.value)}
                ></textarea>
                <button @click=${this.parse}>parse</button>
                <button @click=${this.import}>import</button>
            </article>
            <article>
                <h2>Moods</h2>
                ${this.moodsToMap.map(
                    (mood) =>
                        html`<span
                            class="mood-mappings"
                            @click=${(e) =>
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
                <h2>Activities</h2>
                ${this.activitiesToMap.map(
                    (activity) =>
                        html`<span
                            class="activity-mappings"
                            @click=${(e) =>
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
                border: var(--primary) 1px solid;
                border-radius: 12px;
                display: inline-flex;
                align-content: center;
                gap: 4px;
            }
        `,
    ];
}
