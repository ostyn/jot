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
        console.log('Entry for date', this.date, this.entry);
        this.requestUpdate();
    }
    render() {
        const mood: Mood | undefined = moods.getMood(this.entry?.mood || '');
        return html` <a
            href=""
            @click=${() =>
                go('entries', {
                    queryParams: DateHelpers.getDateStringParts(
                        this.entry.date
                    ),
                })}
        >
            #${this.date}${mood ? html`${mood.emoji}` : ''}
        </a>`;
    }
    static styles = [base, css``];
}
