import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation } from '@vaadin/router';
import { base } from '../baseStyles';
import '../components/calendar-wrapper.component';
import '../components/entry-link.component';
import '../components/mood.component';
import { entryDao } from '../dao/EntryDao';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';
import {
    accumulateStatsFromEntries,
    activities,
} from '../stores/activities.store';
import { moods } from '../stores/moods.store';
import { DateHelpers } from '../utils/DateHelpers';

@customElement('summary-route')
export class SummaryRoute extends MobxLitElement {
    startDate!: Date;
    endDate!: Date;
    stats: Map<string, StatsActivityEntry> = new Map();
    entries: Entry[] = [];
    // Results populated by the summarizer framework after a single pass
    summaryResults: Map<string, any> = new Map();

    /*
     Summarizer framework: create small summarizers with init/accumulate/finalize
     so we can run many summarizers in a single pass over the dataset.
    */

    summarizers: Array<{
        id: string;
        init: () => any;
        accumulate: (state: any, entry: Entry) => void;
        finalize: (state: any) => any;
        render?: (value: any) => unknown;
    }> = [];

    setupSummarizers() {
        const moodsStore = moods;

        this.summarizers = [
            // Best days summarizer (returns array of entries with highest mood rating)
            {
                id: 'bestDays',
                init: () => ({ bestRating: -Infinity, entries: [] as Entry[] }),
                accumulate: (state: any, entry: Entry) => {
                    const mood = moodsStore.getMood(entry.mood);
                    const rating =
                        mood && mood.rating ? parseInt(mood.rating) : NaN;
                    if (isNaN(rating)) return;
                    if (rating > state.bestRating) {
                        state.bestRating = rating;
                        state.entries = [entry];
                    } else if (rating === state.bestRating) {
                        state.entries.push(entry);
                    }
                },
                finalize: (state: any) => state.entries,
                render: (v: Entry[]) => html`
                    <details>
                        <summary>Best days</summary>
                        <div class="entryLinks">
                            ${v.map(
                                (e) => html`
                                    <entry-link .date=${e.date}></entry-link>
                                `
                            )}
                        </div>
                    </details>
                `,
            },
            // Worst days summarizer
            {
                id: 'worstDays',
                init: () => ({ worstRating: Infinity, entries: [] as Entry[] }),
                accumulate: (state: any, entry: Entry) => {
                    const mood = moodsStore.getMood(entry.mood);
                    const rating =
                        mood && mood.rating ? parseInt(mood.rating) : NaN;
                    if (isNaN(rating)) return;
                    if (rating < state.worstRating) {
                        state.worstRating = rating;
                        state.entries = [entry];
                    } else if (rating === state.worstRating) {
                        state.entries.push(entry);
                    }
                },
                finalize: (state: any) => state.entries,
                render: (v: Entry[]) => html`
                    <details>
                        <summary>Worst days</summary>
                        <div class="entryLinks">
                            ${v.map(
                                (e) => html`
                                    <entry-link .date=${e.date}></entry-link>
                                `
                            )}
                        </div>
                    </details>
                `,
            },
            // Chattiest entry (most characters)
            {
                id: 'chattiest',
                init: () => ({ maxChars: 0, entry: null as Entry | null }),
                accumulate: (state: any, entry: Entry) => {
                    let total = entry.note ? entry.note.length : 0;
                    for (const detailList of Object.values(entry.activities)) {
                        if (Array.isArray(detailList)) {
                            detailList.forEach((d) => (total += d.length));
                        }
                    }
                    if (total > state.maxChars) {
                        state.maxChars = total;
                        state.entry = entry;
                    }
                },
                finalize: (state: any) => state.entry,
                render: (v: any) =>
                    html`<p>
                        <strong>Chattiest day:</strong>
                        <entry-link .date=${v.date}></entry-link>
                    </p>`,
            },
            // Fullest entry (most activities + details)
            {
                id: 'fullest',
                init: () => ({ maxCount: 0, entry: null as Entry | null }),
                accumulate: (state: any, entry: Entry) => {
                    const activityCount = Object.keys(entry.activities).length;
                    let detailCount = 0;
                    for (const detailList of Object.values(entry.activities)) {
                        if (Array.isArray(detailList))
                            detailCount += detailList.length;
                    }
                    const total = activityCount + detailCount;
                    if (total > state.maxCount) {
                        state.maxCount = total;
                        state.entry = entry;
                    }
                },
                finalize: (state: any) => state.entry,
                render: (v: any) =>
                    html`<p>
                        <strong>Fullest day:</strong>
                        <entry-link .date=${v.date}></entry-link>
                    </p>`,
            },
            // Most common mood
            {
                id: 'mostCommonMood',
                init: () => ({ counts: {} as Record<string, number> }),
                accumulate: (state: any, entry: Entry) => {
                    state.counts[entry.mood] =
                        (state.counts[entry.mood] || 0) + 1;
                },
                finalize: (state: any) => {
                    let bestId: string | null = null;
                    let bestCount = 0;
                    for (const id in state.counts) {
                        if (state.counts[id] > bestCount) {
                            bestCount = state.counts[id];
                            bestId = id;
                        }
                    }
                    return bestId ? moods.getMood(bestId) : null;
                },
                render: (v: any) =>
                    html`<p>
                        <strong>Most common mood:</strong> ${v
                            ? html`<mood-component
                                  .showName=${true}
                                  .mood=${v}
                              ></mood-component>`
                            : 'N/A'}
                    </p>`,
            },
            // Average mood
            {
                id: 'averageMood',
                init: () => ({ total: 0, count: 0 }),
                accumulate: (state: any, entry: Entry) => {
                    const mood = moodsStore.getMood(entry.mood);
                    if (mood && mood.rating) {
                        const r = parseInt(mood.rating);
                        if (!isNaN(r)) {
                            state.total += r;
                            state.count++;
                        }
                    }
                },
                finalize: (state: any) =>
                    state.count > 0 ? state.total / state.count : null,
                render: (v: any) =>
                    html`<p>
                        <strong>Average mood:</strong> ${typeof v === 'number'
                            ? v.toFixed(2)
                            : 'N/A'}
                    </p>`,
            },
            // Most edited entry (by number of edits)
            {
                id: 'mostEdited',
                init: () => ({ maxEdits: 0, entry: null as Entry | null }),
                accumulate: (state: any, entry: Entry) => {
                    const edits = entry.editLog ? entry.editLog.length : 0;
                    if (edits > state.maxEdits) {
                        state.maxEdits = edits;
                        state.entry = entry;
                    }
                },
                finalize: (state: any) => state.entry,
                render: (v: any) =>
                    html`<p>
                        <strong>Most edited entry:</strong>

                        <entry-link .date=${v.date}></entry-link> (${(
                            v.editLog || []
                        ).length}
                        edits)
                    </p>`,
            },
            // Longest edited entry (by edit duration)
            {
                id: 'longestEdited',
                init: () => ({ maxMs: 0, entry: null as Entry | null }),
                accumulate: (state: any, entry: Entry) => {
                    const ms = (entry.editLog || []).reduce(
                        (s, e) => s + (e?.duration || 0),
                        0
                    );
                    if (ms > state.maxMs) {
                        state.maxMs = ms;
                        state.entry = entry;
                    }
                },
                finalize: (state: any) => state.entry,
                render: (v: any) =>
                    html`<p>
                        <strong>Longest edited entry:</strong>

                        <entry-link .date=${v.date}></entry-link>
                        (${DateHelpers.duration(
                            (v.editLog || []).reduce(
                                (s: any, e: any) => s + (e?.duration || 0),
                                0
                            )
                        )})
                    </p>`,
            },
            // Activities logged count
            {
                id: 'activitiesLogged',
                init: () => ({ total: 0 }),
                accumulate: (state: any, entry: Entry) => {
                    state.total += Object.keys(entry.activities).length;
                },
                finalize: (state: any) => state.total,
                render: (v: any) =>
                    html`<p><strong>Activities logged:</strong> ${v}</p>`,
            },
            // Details logged count
            {
                id: 'detailsLogged',
                init: () => ({ total: 0 }),
                accumulate: (state: any, entry: Entry) => {
                    for (const detailList of Object.values(entry.activities)) {
                        if (Array.isArray(detailList)) {
                            state.total += detailList.length;
                        }
                    }
                },
                finalize: (state: any) => state.total,
                render: (v: any) =>
                    html`<p><strong>Details logged:</strong> ${v}</p>`,
            },
            // Total time spent editing
            {
                id: 'totalEditingTime',
                init: () => ({ totalMs: 0 }),
                accumulate: (state: any, entry: Entry) => {
                    const ms = (entry.editLog || []).reduce(
                        (s, e) => s + (e?.duration || 0),
                        0
                    );
                    state.totalMs += ms;
                },
                finalize: (state: any) => state.totalMs,
                render: (v: any) =>
                    html`<p>
                        <strong>Total time spent editing:</strong>
                        ${DateHelpers.duration(v)}
                    </p>`,
            },
        ];
    }

    runSummaries(entries: Entry[]) {
        if (!this.summarizers || this.summarizers.length === 0)
            this.setupSummarizers();
        const states = new Map<string, any>();
        for (const s of this.summarizers) {
            states.set(s.id, s.init());
        }
        for (const entry of entries) {
            for (const s of this.summarizers) {
                try {
                    s.accumulate(states.get(s.id), entry);
                } catch (err) {
                    // keep going if one summarizer fails for some entry
                    console.warn('summarizer error', s.id, err);
                }
            }
        }
        this.summaryResults.clear();
        for (const s of this.summarizers) {
            this.summaryResults.set(s.id, s.finalize(states.get(s.id)));
        }
    }
    async onAfterEnter(location: RouterLocation) {
        if (location.params.start && location.params.end) {
            this.startDate = new Date(
                ...((location.params.start as string)
                    .split('-')
                    .map((v: string, i: number) =>
                        i === 1 ? parseInt(v) - 1 : parseInt(v)
                    ) as [number, number, number])
            );
            this.endDate = new Date(
                ...((location.params.end as string)
                    .split('-')
                    .map((v: string, i: number) =>
                        i === 1 ? parseInt(v) - 1 : parseInt(v)
                    ) as [number, number, number])
            );
            this.endDate.setHours(23, 59, 59, 999);
            this.entries = await entryDao.getEntriesBetweenDates(
                this.startDate,
                this.endDate
            );
            this.stats = accumulateStatsFromEntries(this.entries);
            this.runSummaries(this.entries);
            this.requestUpdate();
        }
        window.scrollTo({ top: 0 });
    }
    render() {
        return html` <div class="route-container">
            <article>
                <h2>
                    Summary from ${this.startDate.toLocaleDateString()} to
                    ${this.endDate.toLocaleDateString()}
                </h2>
                <div>
                    ${(() => {
                        if (!this.summarizers || this.summarizers.length === 0)
                            this.setupSummarizers();
                        const format = (v: any) => {
                            if (v === null || v === undefined) return 'N/A';
                            if (typeof v === 'number') return v.toFixed(2);
                            return String(v);
                        };

                        return this.summarizers.map((s) => {
                            const val = this.summaryResults.get(s.id);
                            try {
                                if (s.render) return s.render(val);
                            } catch (e) {
                                console.warn('summary render error', s.id, e);
                            }
                            return html`<p>
                                <strong>${s.id}:</strong> ${format(val)}
                            </p>`;
                        });
                    })()}
                </div>
            </article>
            <div class="activity-stats">
                ${map(activities.allVisibleActivities, (activity: Activity) => {
                    const activityStats = this.stats.get(activity.id);
                    return this.stats.has(activity.id) && activityStats
                        ? html`<article>
                              <activity-component
                                  .activity=${activity}
                                  .showName=${true}
                              ></activity-component>
                              <p>Count recorded: ${activityStats.count}</p>
                              <p>
                                  Days recorded: ${activityStats.dates.length}
                              </p>
                              <p>
                                  Distinct details recorded:
                                  ${activityStats.detailsUsed
                                      ? activityStats.detailsUsed.size
                                      : 0}
                              </p>
                              <p>
                                  Times that details were recorded:
                                  ${Array.from(
                                      activityStats.detailsUsed?.values() || []
                                  ).reduce(
                                      (acc, detail) => acc + detail.count,
                                      0
                                  )}
                              </p>
                              <p>
                                  Percent of elapsed days in period with
                                  activity:
                                  ${(
                                      (activityStats.dates.length /
                                          Math.ceil(
                                              ((this.endDate > new Date()
                                                  ? new Date().getTime()
                                                  : this.endDate.getTime()) -
                                                  this.startDate.getTime()) /
                                                  (1000 * 60 * 60 * 24)
                                          )) *
                                      100
                                  ).toFixed(2)}%
                              </p>
                              <p>
                                  Average per day:
                                  ${(
                                      activityStats.count /
                                      Math.ceil(
                                          ((this.endDate > new Date()
                                              ? new Date().getTime()
                                              : this.endDate.getTime()) -
                                              this.startDate.getTime()) /
                                              (1000 * 60 * 60 * 24)
                                      )
                                  ).toFixed(2)}
                              </p>
                              <p>
                                  Average per day when recorded:
                                  ${(
                                      activityStats.count /
                                      activityStats.dates.length
                                  ).toFixed(2)}
                              </p>
                              ${activityStats.detailsUsed?.size
                                  ? html`
                                        <p>Top 10 details used:</p>
                                        ${map(
                                            Array.from(
                                                activityStats.detailsUsed?.values() ||
                                                    []
                                            )
                                                .sort(
                                                    (a, b) => b.count - a.count
                                                )
                                                .slice(0, 10),
                                            (detail) =>
                                                html`<div>
                                                    <activity-detail
                                                        >${detail.text}</activity-detail
                                                    >
                                                    : ${detail.count} times
                                                </div>`
                                        )}
                                    `
                                  : nothing}
                          </article>`
                        : nothing;
                })}
            </div>
        </div>`;
    }
    static styles = [
        base,
        css`
            .entryLinks {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .activity-stats {
                padding-top: 1rem;
                display: grid;
                gap: 1rem;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            }
        `,
    ];
}
