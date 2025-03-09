import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { EditLog } from '../interfaces/entry.interface';
import { DateHelpers } from '../utils/DateHelpers';

@customElement('edit-log-dates')
export class EditLogDates extends LitElement {
    @property({ type: Array }) editLog!: EditLog[];
    msSpentEditing = () =>
        this.editLog?.reduce((sum, entry) => sum + (entry?.duration ?? 0), 0);
    render() {
        return html`
            <div class="entry-footer-dates">
                <span>
                    Entered
                    ${DateHelpers.dateToStringDate(this.editLog[0].date)},
                    ${DateHelpers.dateToStringTime(this.editLog[0].date)}<br />
                </span>
                ${this.editLog?.length > 1
                    ? html`
                          <span>
                              Updated
                              ${DateHelpers.dateToStringDate(
                                  this.editLog[this.editLog.length - 1].date
                              )},
                              ${DateHelpers.dateToStringTime(
                                  this.editLog[this.editLog.length - 1].date
                              )}<br />
                          </span>
                          ${this.msSpentEditing() > 0
                              ? html`
                                    <span>
                                        ${DateHelpers.duration(
                                            this.msSpentEditing()
                                        )}
                                        spent editing
                                        ${this.editLog.length > 1
                                            ? html`across ${this.editLog.length}
                                              sessions`
                                            : nothing}
                                        <br />
                                    </span>
                                `
                              : nothing}
                      `
                    : nothing}
                ${['DAYLIO_IMPORT', 'DAYLIO'].includes(this.editLog[0].tool)
                    ? html`<span>Imported from Daylio<br /></span>`
                    : nothing}
            </div>
        `;
    }
    static styles = css`
        .entry-footer-dates {
            display: inline-block;
            text-align: right;
        }
        .entry-footer-dates {
            font-size: 0.75rem;
            line-height: 1rem;
            color: var(--pico-secondary);
        }
    `;
}
