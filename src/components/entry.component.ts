import { html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import './activity.component';

@customElement('entry-component')
export class EntryComponent extends LitElement {
    activities: Activity[] = data.activities as unknown as Activity[];
    @property()
    public entry: Entry = {} as Entry;
    render() {
        if (!this.entry) return nothing;
        return html`<article>
            <div>${this.entry.date} ${this.entry.note}</div>
            ${Array.from(Object.keys(this.entry.activities)).map(
                (activityId) => {
                    return html`<activity-component
                        .activity=${this.activities.find(
                            (activity) => activity.id === activityId
                        )}
                        .detail=${this.entry.activities[activityId]}
                    ></activity-component>`;
                }
            )}
        </article>`;
    }
    static styles = [base];
}
