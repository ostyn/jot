import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { betterGo } from '../routes/route-config';
import { reminders } from '../stores/reminders.store';
import './activity.component';
import './jot-icon';

@customElement('reminders-section')
export class RemindersSection extends MobxLitElement {
    private logNow(activityId: string) {
        betterGo('entry', { queryParams: { activity: activityId } });
    }
    private dismiss(activityId: string) {
        reminders.dismissReminder(activityId);
    }
    private overdueLabel(daysOverdue: number, neverLogged: boolean) {
        if (neverLogged) return 'Never logged';
        if (daysOverdue === 0) return 'Due today';
        return `Overdue ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`;
    }
    render() {
        const due = reminders.dueReminders;
        if (due.length === 0) return nothing;
        return html`<article id="reminders" class="remindersSection">
            <header class="remindersHeader">
                <jot-icon name="Bell"></jot-icon>
                <span>Reminders</span>
            </header>
            <ul class="remindersList">
                ${due.map(
                    ({ activity, daysOverdue, metrics, effectiveInterval }) =>
                        html`<li class="reminderRow">
                            <activity-component
                                .activity=${activity}
                                .showName=${true}
                            ></activity-component>
                            <span class="reminderMeta">
                                <span class="reminderOverdueText">
                                    ${this.overdueLabel(
                                        daysOverdue,
                                        metrics.totalLogs === 0
                                    )}
                                </span>
                                <small class="reminderCadenceText">
                                    every ${effectiveInterval} day${effectiveInterval ===
                                    1
                                        ? ''
                                        : 's'}
                                </small>
                            </span>
                            <span class="reminderActions">
                                <button
                                    class="inline"
                                    type="button"
                                    aria-label="log now"
                                    @click=${() => this.logNow(activity.id)}
                                >
                                    <jot-icon name="PenLine"></jot-icon>
                                </button>
                                <button
                                    class="inline secondary"
                                    type="button"
                                    aria-label="dismiss"
                                    @click=${() => this.dismiss(activity.id)}
                                >
                                    <jot-icon name="X"></jot-icon>
                                </button>
                            </span>
                        </li>`
                )}
            </ul>
        </article>`;
    }
    static styles = [
        base,
        css`
            .remindersSection {
                margin-bottom: 1rem;
                padding: 0.75rem 1rem;
            }
            .remindersHeader {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            .remindersList {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .reminderRow {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            activity-component {
                flex-shrink: 0;
            }
            .reminderMeta {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-width: 0;
            }
            .reminderOverdueText {
                font-size: 0.875rem;
            }
            .reminderCadenceText {
                color: var(--pico-muted-color);
            }
            .reminderActions {
                display: flex;
                gap: 0.25rem;
                flex-shrink: 0;
            }
            .reminderActions button {
                padding: 0.25rem 0.5rem;
                margin: 0;
                width: auto;
            }
        `,
    ];
}

