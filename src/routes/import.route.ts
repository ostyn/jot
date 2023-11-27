import { html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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
    handleFile() {
        this.isLoading = true;
        const fileInput = this.shadowRoot?.getElementById('fileInput');
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (file.type === 'application/json') {
                    const data = JSON.parse(event.target?.result as string);
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
        this.isLoading = true;
        setTimeout(() => {
            entries.bulkImport(this.entries);
            activities.bulkImport(this.activities);
            moods.bulkImport(this.moods);
            this.isLoading = false;
        }, 1);
    }
    render() {
        return html`<article>
                <header>Import</header>
                <input
                    @change=${this.handleFile}
                    id="fileInput"
                    type="file"
                    accept=".json"
                />
                ${this.isLoading
                    ? html`<span aria-busy="true">Loading...</span>`
                    : this.entries.length
                    ? html`<button @click=${this.import}>Import</button>`
                    : nothing}
            </article>
            ${this.entries.map(
                (e) => html`<entry-component .entry=${e}></entry-component>`
            )} `;
    }
    static styles = [base];
}
