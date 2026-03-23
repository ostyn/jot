import { html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { activityDetailLocationMappingDao } from '../dao/ActivityDetailLocationMappingDao';
import { locationDao } from '../dao/LocationDao';
import { Activity } from '../interfaces/activity.interface';
import {
    ActivityDetailLocationMapping,
    EditTools,
    Entry,
    Location,
} from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { Note } from '../interfaces/note.interface';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { notes } from '../stores/notes.store';
import { JsonExport, prepJsonForImport } from '../utils/BackupHelpers';

@customElement('import-route')
export class ImportRoute extends LitElement {
    @state()
    entries: Entry[] = [];
    @state()
    activities: Activity[] = [];
    @state()
    moods: Mood[] = [];
    @state()
    notes: Note[] = [];
    @state()
    locations: Location[] = [];
    @state()
    activityDetailLocationMappings: ActivityDetailLocationMapping[] = [];
    @state()
    isLoading = false;
    @state()
    importEntries = true;
    @state()
    importMoods = true;
    @state()
    importActivities = true;
    @state()
    importNotes = true;
    @state()
    importLocations = true;
    @state()
    importMappings = true;
    @state()
    overwriteExistingData = true;
    handleFile() {
        this.isLoading = true;
        const fileInput = this.shadowRoot?.getElementById('fileInput');
        const file = (fileInput as any).files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (
                    file.type === 'application/json' ||
                    file.type === 'text/plain'
                ) {
                    const data: JsonExport = JSON.parse(
                        event.target?.result as string
                    );
                    prepJsonForImport(data);
                    this.entries = data.entries;
                    this.moods = data.moods;
                    this.activities = data.activities;
                    this.notes = data.notes || [];
                    this.locations = data.locations || [];
                    this.activityDetailLocationMappings =
                        data.activityDetailLocationMappings || [];
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
                    entries.bulkImport(this.entries, EditTools.JSON_IMPORT);
                }
                if (this.importMoods) {
                    if (this.overwriteExistingData) {
                        moods.reset();
                    }
                    moods.bulkImport(this.moods, EditTools.JSON_IMPORT);
                }
                if (this.importActivities) {
                    if (this.overwriteExistingData) {
                        activities.reset();
                    }
                    activities.bulkImport(
                        this.activities,
                        EditTools.JSON_IMPORT
                    );
                }
                if (this.importNotes) {
                    if (this.overwriteExistingData) {
                        notes.reset();
                    }
                    notes.bulkImport(this.notes, EditTools.JSON_IMPORT);
                }
                if (this.importLocations && this.locations.length) {
                    if (this.overwriteExistingData) {
                        locationDao.reset();
                    }
                    locationDao.saveItems(
                        this.locations,
                        EditTools.JSON_IMPORT
                    );
                }
                if (
                    this.importMappings &&
                    this.activityDetailLocationMappings.length
                ) {
                    if (this.overwriteExistingData) {
                        activityDetailLocationMappingDao.reset();
                    }
                    activityDetailLocationMappingDao.saveItems(
                        this.activityDetailLocationMappings,
                        EditTools.JSON_IMPORT
                    );
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

            ${this.entries.length ||
            this.moods.length ||
            this.activities.length ||
            this.locations.length
                ? html` <p>
                      <label
                          ><input
                              type="checkbox"
                              ?checked=${this.importEntries}
                              @change=${() =>
                                  (this.importEntries = !this.importEntries)}
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
                      <label
                          ><input
                              type="checkbox"
                              ?checked=${this.importNotes}
                              @change=${() =>
                                  (this.importNotes = !this.importNotes)}
                          />Notes: ${this.notes.length}
                      </label>
                      <label
                          ><input
                              type="checkbox"
                              ?checked=${this.importLocations}
                              @change=${() =>
                                  (this.importLocations =
                                      !this.importLocations)}
                          />Locations: ${this.locations.length}
                      </label>
                      <label
                          ><input
                              type="checkbox"
                              ?checked=${this.importMappings}
                              @change=${() =>
                                  (this.importMappings = !this.importMappings)}
                          />Location Mappings:
                          ${this.activityDetailLocationMappings.length}
                      </label>
                      <hr />
                      <label
                          ><input
                              type="checkbox"
                              ?checked=${this.overwriteExistingData}
                              @change=${() =>
                                  (this.overwriteExistingData =
                                      !this.overwriteExistingData)}
                          />Overwrite Existing Data
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
