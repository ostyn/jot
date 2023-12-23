import { html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { parseISO } from 'date-fns';
import { base } from '../baseStyles';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';

@customElement('import-route')
export class ImportRoute extends LitElement {
    @state()
    entries: Entry[] = [];
    @state()
    activities: Activity[] = [];
    @state()
    moods: Mood[] = [];
    @state()
    isLoading = false;
    @state()
    importEntries = true;
    @state()
    importMoods = true;
    @state()
    importActivities = true;
    @state()
    overwriteExistingData = true;
    handleFile() {
        this.isLoading = true;
        const fileInput = this.shadowRoot?.getElementById('fileInput');
        const file = (fileInput as any).files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                alert(file.type);
                if (
                    file.type === 'application/json' ||
                    file.type === 'application/text'
                ) {
                    const data = JSON.parse(event.target?.result as string);
                    data.entries.forEach((entry: Entry) => {
                        entry.created = parseISO(
                            entry.created as unknown as string
                        );
                        entry.updated = parseISO(
                            entry.updated as unknown as string
                        );
                        entry.dateObject = new Date(entry.date);
                    });
                    data.moods.forEach((mood: Mood) => {
                        mood.created = parseISO(
                            mood.created as unknown as string
                        );
                        mood.updated = parseISO(
                            mood.updated as unknown as string
                        );
                    });
                    data.activities.forEach((activity: Activity) => {
                        activity.created = parseISO(
                            activity.created as unknown as string
                        );
                        activity.updated = parseISO(
                            activity.updated as unknown as string
                        );
                    });
                    this.entries = data.entries;
                    this.moods = data.moods;
                    this.activities = data.activities;
                    this.isLoading = false;
                }
            };
            reader.readAsText(file);
        } else {
            console.log('No file selected');
        }
    }
    import() {
        if (confirm('Are you sure?')) {
            this.isLoading = true;
            setTimeout(() => {
                if (this.importEntries) {
                    if (this.overwriteExistingData) {
                        entries.reset();
                    }
                    entries.bulkImport(this.entries);
                }
                if (this.importMoods) {
                    if (this.overwriteExistingData) {
                        moods.reset();
                    }
                    moods.bulkImport(this.moods);
                }
                if (this.importActivities) {
                    if (this.overwriteExistingData) {
                        activities.reset();
                    }
                    activities.bulkImport(this.activities);
                }
                this.isLoading = false;
            }, 1);
        }
    }
    render() {
        return html`<article>
            <header>Import</header>
            <input
                @change=${this.handleFile}
                id="fileInput"
                type="file"
                accept=".json,.txt"
            />

            ${this.entries.length || this.moods.length || this.activities.length
                ? html` <label
                          ><input
                              type="checkbox"
                              ?checked=${this.overwriteExistingData}
                              @change=${() =>
                                  (this.overwriteExistingData =
                                      !this.overwriteExistingData)}
                          />Overwrite Existing Data
                      </label>
                      <p>
                          <label
                              ><input
                                  type="checkbox"
                                  ?checked=${this.importEntries}
                                  @change=${() =>
                                      (this.importEntries =
                                          !this.importEntries)}
                              />Entries: ${this.entries.length}
                          </label>
                          <label
                              ><input
                                  type="checkbox"
                                  ?checked=${this.importMoods}
                                  @change=${() =>
                                      (this.importMoods = !this.importMoods)}
                              />Moods: ${this.moods.length}
                          </label>
                          <label
                              ><input
                                  type="checkbox"
                                  ?checked=${this.importActivities}
                                  @change=${() =>
                                      (this.importActivities =
                                          !this.importActivities)}
                              />Activities: ${this.activities.length}
                          </label>
                      </p>`
                : nothing}
            ${this.isLoading
                ? html`<span aria-busy="true">Loading...</span>`
                : this.entries.length
                ? html`<button @click=${this.import}>Import</button>`
                : nothing}
        </article>`;
    }
    static styles = [base];
}
