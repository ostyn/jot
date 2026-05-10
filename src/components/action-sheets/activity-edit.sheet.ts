import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../../baseStyles';
import {
    Activity,
    ActivityReminderConfig,
} from '../../interfaces/activity.interface';
import { activities } from '../../stores/activities.store';
import { getActivityFrequencyMetrics } from '../../utils/activity-frequency';
import { dispatchEvent, Events } from '../../utils/Helpers';

@customElement('activity-edit-sheet')
export class ActivityEditSheet extends MobxLitElement {
    inputRef: Ref<HTMLElement> = createRef();
    @property({ attribute: false })
    activity!: Activity;
    @state()
    localActivity: Activity = {
        isArchived: false,
        name: '',
        category: '',
        emoji: '',
    } as Activity;
    firstUpdated() {
        this.localActivity = { ...this.localActivity, ...this.activity };
    }
    @property({ attribute: false })
    isCustom = false;

    deleteActivity() {
        if (confirm('Sure you want to delete?')) {
            activities.removeActivity(this.localActivity.id);
            dispatchEvent(this, Events.activityDeleted);
        }
    }
    submitActivity() {
        activities.updateActivity(this.localActivity);
        dispatchEvent(this, Events.activitySubmitted);
    }
    private updateReminder(patch: Partial<ActivityReminderConfig>) {
        const current: ActivityReminderConfig = this.localActivity.reminder ?? {
            enabled: false,
            intervalDaysOverride: null,
        };
        this.localActivity = {
            ...this.localActivity,
            reminder: { ...current, ...patch },
        };
    }
    private toggleReminderEnabled(enabled: boolean) {
        // When enabling on an activity without enough history for an avg,
        // default to Custom mode so the user has something to anchor on.
        if (enabled) {
            const metrics = getActivityFrequencyMetrics(
                activities.stats.get(this.localActivity.id)
            );
            const fallbackOverride = metrics.canAutoCadence
                ? this.localActivity.reminder?.intervalDaysOverride ?? null
                : this.localActivity.reminder?.intervalDaysOverride ??
                  (metrics.avgDaysBetween ?? 7);
            this.updateReminder({
                enabled: true,
                intervalDaysOverride: fallbackOverride,
            });
        } else {
            this.updateReminder({ enabled: false });
        }
    }
    private setReminderMode(mode: 'auto' | 'custom') {
        if (mode === 'auto') {
            this.updateReminder({ intervalDaysOverride: null });
        } else {
            const metrics = getActivityFrequencyMetrics(
                activities.stats.get(this.localActivity.id)
            );
            const seed =
                this.localActivity.reminder?.intervalDaysOverride ??
                metrics.avgDaysBetween ??
                7;
            this.updateReminder({ intervalDaysOverride: seed });
        }
    }
    private setReminderInterval(value: string) {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n) && n > 0) {
            this.updateReminder({ intervalDaysOverride: n });
        }
    }
    selectCategory(value: string) {
        this.changeCategory(value);
        this.isCustom = false;
    }
    changeCategory(category: string) {
        this.shadowRoot
            ?.querySelector('.category-control')
            ?.removeAttribute('open');
        this.localActivity = { ...this.localActivity, category };
    }
    selectCustom() {
        this.isCustom = true;
        this.inputRef?.value?.focus();
    }
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<activity-edit-sheet
            @activityDeleted=${submit}
            @activitySubmitted=${submit}
            .activity=${data}
        ></activity-edit-sheet>`;
    }
    private renderReminderSection() {
        if (!this.localActivity?.id) return nothing;
        const reminder = this.localActivity.reminder;
        const enabled = !!reminder?.enabled;
        const metrics = getActivityFrequencyMetrics(
            activities.stats.get(this.localActivity.id)
        );
        const usingAuto = enabled && reminder?.intervalDaysOverride == null;
        const autoLabel = metrics.avgDaysBetween
            ? `Auto (every ~${metrics.avgDaysBetween} day${
                  metrics.avgDaysBetween === 1 ? '' : 's'
              })`
            : 'Auto';
        return html`<section class="reminderSection">
            <label class="inline reminderSwitch"
                ><input
                    type="checkbox"
                    role="switch"
                    .checked=${enabled}
                    @change=${(e: any) =>
                        this.toggleReminderEnabled(e.target.checked)}
                />Reminder</label
            >
            ${enabled
                ? html`<div class="reminderBody">
                      <small class="reminderInfo">
                          ${metrics.canAutoCadence
                              ? `Average cadence: every ~${metrics.avgDaysBetween} day${metrics.avgDaysBetween === 1 ? '' : 's'} (${metrics.totalLogs} logs)`
                              : metrics.avgDaysBetween
                                ? `Only ${metrics.totalLogs} logs so far — average not stable yet.`
                                : 'Not enough history yet for an average.'}
                      </small>
                      <label class="reminderRadio">
                          <input
                              type="radio"
                              name="reminder-mode"
                              .checked=${usingAuto}
                              ?disabled=${!metrics.canAutoCadence}
                              @change=${() => this.setReminderMode('auto')}
                          />
                          ${autoLabel}
                      </label>
                      <label class="reminderRadio">
                          <input
                              type="radio"
                              name="reminder-mode"
                              .checked=${!usingAuto}
                              @change=${() => this.setReminderMode('custom')}
                          />
                          Custom: every
                          <input
                              class="reminderIntervalInput"
                              type="number"
                              min="1"
                              step="1"
                              .value=${String(
                                  reminder?.intervalDaysOverride ??
                                      metrics.avgDaysBetween ??
                                      ''
                              )}
                              ?disabled=${usingAuto}
                              @change=${(e: any) =>
                                  this.setReminderInterval(e.target.value)}
                          />
                          days
                      </label>
                  </div>`
                : nothing}
        </section>`;
    }
    render() {
        return html`<form>
            <section class="activity-inputs">
                <input
                    class="inline"
                    type="text"
                    .value=${this.localActivity?.name || ''}
                    @change=${(e: any) => {
                        this.localActivity = {
                            ...this.localActivity,
                            name: e.target.value,
                        };
                    }}
                    placeholder="name"
                />
                <input
                    class="inline"
                    type="text"
                    .value=${this.localActivity?.emoji || ''}
                    @change=${(e: any) => {
                        this.localActivity = {
                            ...this.localActivity,
                            emoji: e.target.value,
                        };
                    }}
                    placeholder="emoji"
                />
            </section>
            <section class="lastRow">
                <details class="inline category-control" role="list">
                    <summary aria-haspopup="listbox">
                        ${this.localActivity?.category || 'category'}
                    </summary>
                    <ul role="listbox" class="option-list">
                        <li @click=${this.selectCustom}>
                            <label>
                                <input
                                    class="radio-button"
                                    type="radio"
                                    name="category"
                                />
                                ${this.isCustom
                                    ? html`<input
                                          ${ref(this.inputRef)}
                                          class="custom-category"
                                          type="text"
                                          @change=${(e: any) =>
                                              this.changeCategory(
                                                  e.target.value
                                              )}
                                          .value=${this.localActivity
                                              .category || ''}
                                          placeholder="category"
                                          focus="true"
                                      />`
                                    : html`<span>** new category **</span>`}
                            </label>
                        </li>
                        ${activities.getCategories().map(
                            (category) => html`
                                <li
                                    @click=${(e: any) =>
                                        this.selectCategory(e.target.value)}
                                    .class=${this.localActivity?.category ===
                                    category
                                        ? 'selected-category'
                                        : ''}
                                >
                                    <label>
                                        <input
                                            type="radio"
                                            name="category"
                                            .value=${category || ''}
                                            .checked=${category ===
                                            this.localActivity?.category}
                                            class="radio-button"
                                        />
                                        ${category}
                                    </label>
                                </li>
                            `
                        )}
                    </ul>
                </details>
                <label class="inline archiveSwitch"
                    ><input
                        type="checkbox"
                        role="switch"
                        .checked=${this.localActivity?.isArchived}
                        @change=${() => {
                            this.localActivity = {
                                ...this.localActivity,
                                isArchived: !this.localActivity.isArchived,
                            };
                        }}
                    />Archived</label
                >
            </section>
            ${this.renderReminderSection()}
            <section>
                <button
                    class="inline"
                    type="button"
                    @click=${this.submitActivity}
                >
                    submit
                </button>
                ${this.localActivity?.id
                    ? html`<button
                          class="inline secondary"
                          type="button"
                          @click=${this.deleteActivity}
                      >
                          delete
                      </button>`
                    : nothing}
            </section>
        </form>`;
    }
    static styles = [
        base,
        css`
            .activity-edit-buttons {
                text-align: center;
            }
            activity-edit .category-control .option-list {
                position: relative;
            }
            .category-control * {
                z-index: 50;
                width: fit-content;
            }
            input.custom-category {
                width: calc(100% - 20px);
            }
            .selected-category {
                background-color: var(--pico-contrast);
                color: var(--pico-contrast-inverse);
            }
            .radio-button {
                position: absolute;
                opacity: 0;
            }
            .category-control ul.option-list {
                position: unset;
            }
            .option-list * {
                cursor: pointer;
            }
            .lastRow {
                display: flex;
                gap: 16px;
            }
            .archiveSwitch {
                padding: 12px;
            }
            .reminderSection {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding-top: 0.5rem;
            }
            .reminderSwitch {
                padding: 12px;
            }
            .reminderBody {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding-left: 12px;
            }
            .reminderInfo {
                color: var(--pico-muted-color);
            }
            .reminderRadio {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                cursor: pointer;
            }
            .reminderRadio input[type='radio'] {
                margin: 0;
            }
            .reminderIntervalInput {
                width: 4.5rem;
                margin: 0 0.25rem;
            }
        `,
    ];
}
