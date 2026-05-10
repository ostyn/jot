import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { betterGo } from '../routes/route-config';
import { activities } from '../stores/activities.store';
import { ReminderStatus, reminders } from '../stores/reminders.store';
import { Sheet } from './action-sheets/action-sheet';
import { ActivityEditSheet } from './action-sheets/activity-edit.sheet';
import { ActivityInfoSheet } from './action-sheets/activity-info.sheet';
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
    private enable(activityId: string) {
        reminders.enableReminder(activityId);
    }
    private dismissSuggestion(activityId: string) {
        reminders.dismissSuggestion(activityId);
    }
    private openEdit(activityId: string) {
        Sheet.open({
            type: ActivityEditSheet,
            data: activities.getActivity(activityId),
        });
    }
    private openInfo(activityId: string) {
        Sheet.open({
            type: ActivityInfoSheet,
            data: { id: activityId, date: new Date() },
        });
    }
    private statusLabel(r: ReminderStatus) {
        if (r.metrics.totalLogs === 0) return 'Never logged';
        if (r.daysOverdue > 0)
            return `Overdue ${r.daysOverdue} day${
                r.daysOverdue === 1 ? '' : 's'
            }`;
        if (r.daysOverdue === 0) return 'Due today';
        const inDays = -r.daysOverdue;
        return `Next in ${inDays} day${inDays === 1 ? '' : 's'}`;
    }
    private renderReminders() {
        const list = reminders.enabledReminders;
        if (list.length === 0) return nothing;
        return html`<section class="remindersSubsection">
            <header class="remindersHeader">
                <jot-icon name="Bell"></jot-icon>
                <span>Reminders</span>
            </header>
            <ul class="remindersList">
                ${list.map(
                    (r) =>
                        html`<li
                            class=${'reminderRow ' +
                            (r.isOverdue ? 'reminderRowDue' : '')}
                        >
                            <activity-component
                                .activity=${r.activity}
                                .showName=${true}
                                @activityClick=${() =>
                                    this.openEdit(r.activity.id)}
                                @activityLongClick=${() =>
                                    this.openInfo(r.activity.id)}
                            ></activity-component>
                            <span class="reminderMeta">
                                <span class="reminderStatusText">
                                    ${this.statusLabel(r)}
                                </span>
                                <small class="reminderCadenceText">
                                    every ${r.effectiveInterval} day${r.effectiveInterval ===
                                    1
                                        ? ''
                                        : 's'}
                                </small>
                            </span>
                            <span class="reminderActions">
                                ${r.isOverdue
                                    ? html`<button
                                              class="inline"
                                              type="button"
                                              aria-label="log now"
                                              @click=${() =>
                                                  this.logNow(r.activity.id)}
                                          >
                                              <jot-icon
                                                  name="PenLine"
                                              ></jot-icon>
                                          </button>
                                          <button
                                              class="inline secondary"
                                              type="button"
                                              aria-label="snooze for today"
                                              @click=${() =>
                                                  this.dismiss(r.activity.id)}
                                          >
                                              <jot-icon name="Clock"></jot-icon>
                                          </button>`
                                    : nothing}
                            </span>
                        </li>`
                )}
            </ul>
        </section>`;
    }
    private renderSuggestions() {
        const suggestions = reminders.suggestedReminders;
        if (suggestions.length === 0) return nothing;
        return html`<section class="remindersSubsection">
            <header class="remindersHeader">
                <jot-icon name="TrendingUp"></jot-icon>
                <span>Suggested reminders</span>
            </header>
            <ul class="remindersList">
                ${suggestions.map(
                    ({ activity, avgDaysBetween }) =>
                        html`<li class="reminderRow">
                            <activity-component
                                .activity=${activity}
                                .showName=${true}
                                @activityClick=${() =>
                                    this.openEdit(activity.id)}
                                @activityLongClick=${() =>
                                    this.openInfo(activity.id)}
                            ></activity-component>
                            <span class="reminderMeta">
                                <span class="reminderStatusText">
                                    Regular cadence detected
                                </span>
                                <small class="reminderCadenceText">
                                    about every ${avgDaysBetween} day${avgDaysBetween ===
                                    1
                                        ? ''
                                        : 's'}
                                </small>
                            </span>
                            <span class="reminderActions">
                                <button
                                    class="inline"
                                    type="button"
                                    aria-label="enable reminder"
                                    @click=${() => this.enable(activity.id)}
                                >
                                    <jot-icon name="Bell"></jot-icon>
                                </button>
                                <button
                                    class="inline secondary"
                                    type="button"
                                    aria-label="dismiss suggestion"
                                    @click=${() =>
                                        this.dismissSuggestion(activity.id)}
                                >
                                    <jot-icon name="X"></jot-icon>
                                </button>
                            </span>
                        </li>`
                )}
            </ul>
        </section>`;
    }
    render() {
        const reminderList = this.renderReminders();
        const suggestions = this.renderSuggestions();
        if (reminderList === nothing && suggestions === nothing) return nothing;
        return html`<article class="remindersSection">
            ${reminderList}${suggestions}
        </article>`;
    }
    static styles = [
        base,
        css`
            .remindersSection {
                margin-bottom: 1rem;
                padding: 0.75rem 1rem;
            }
            .remindersSubsection + .remindersSubsection {
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--pico-muted-border-color);
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
                opacity: 0.65;
            }
            .reminderRowDue {
                opacity: 1;
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
            .reminderStatusText {
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
