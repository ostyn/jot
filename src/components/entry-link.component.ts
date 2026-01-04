import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { entryDao } from '../dao/EntryDao';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { go } from '../routes/route-config';
import { moods } from '../stores/moods.store';
import { DateHelpers } from '../utils/DateHelpers';

@customElement('entry-link')
export class EntryLinkComponent extends LitElement {
    @property()
    date!: string;
    entry!: Entry;
    protected async firstUpdated() {
        this.entry = (await entryDao.getEntriesFromDate(this.date))[0];
        this.requestUpdate();
    }
    getUrlForHref() {
        if (!this.entry) {
            return '#';
        }
        return `/entries?year=${this.entry.date.split('-')[0]}&month=${this.entry.date.split('-')[1]}&day=${this.entry.date.split('-')[2]}`;
    }
    render() {
        const mood: Mood | undefined = moods.getMood(this.entry?.mood || '');
        return html` <a href="${this.getUrlForHref()}">
            #${this.date}${mood ? html`${mood.emoji}` : ''}
        </a>`;
    }
    static styles = [
        base,
        css`
            :host {
                min-width: 14ch;
                text-align: right;
            }
        `,
    ];
}
