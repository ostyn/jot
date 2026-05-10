import { format, subDays } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { Activity } from '../interfaces/activity.interface';
import { EditTools, Entry } from '../interfaces/entry.interface';
import { activities } from './activities.store';
import { entries } from './entries.store';
import { reminders } from './reminders.store';

const NOW = new Date();
const today = format(NOW, 'yyyy-MM-dd');
const daysAgo = (n: number) => format(subDays(NOW, n), 'yyyy-MM-dd');

function makeActivity(id: string, overrides: Partial<Activity> = {}): Activity {
    return {
        id,
        name: id,
        emoji: '🏃',
        category: undefined,
        isArchived: false,
        created: new Date(),
        updated: new Date(),
        ...overrides,
    };
}

function makeEntry(date: string, activityIds: string[]): Entry {
    const acts: Entry['activities'] = {};
    activityIds.forEach((id) => (acts[id] = 1));
    return {
        date,
        mood: '0',
        activities: acts,
        note: '',
        editLog: [{ date: new Date(), tool: EditTools.JOT }],
    };
}

beforeEach(async () => {
    await entries.reset();
    await activities.reset();
});

describe('RemindersStore.enabledReminders', () => {
    it('is empty when no activities have reminders', async () => {
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        await entries.upsertEntry(makeEntry(daysAgo(20), ['a1']));
        expect(reminders.enabledReminders).toEqual([]);
    });

    it('is empty when reminder is disabled', async () => {
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: false, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        await entries.upsertEntry(makeEntry(daysAgo(20), ['a1']));
        expect(reminders.enabledReminders).toEqual([]);
    });

    it('surfaces an overdue reminder using avg cadence', async () => {
        // 3 logs spaced ~5 days apart, last was 8 days ago → overdue 3
        await entries.upsertEntry(makeEntry(daysAgo(18), ['a1']));
        await entries.upsertEntry(makeEntry(daysAgo(13), ['a1']));
        await entries.upsertEntry(makeEntry(daysAgo(8), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: null },
                }),
            ],
            EditTools.JOT
        );
        const list = reminders.enabledReminders;
        expect(list).toHaveLength(1);
        expect(list[0].activity.id).toBe('a1');
        expect(list[0].effectiveInterval).toBe(5);
        expect(list[0].daysOverdue).toBe(3);
        expect(list[0].isOverdue).toBe(true);
    });

    it('respects user override over computed avg', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(8), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        const list = reminders.enabledReminders;
        expect(list).toHaveLength(1);
        expect(list[0].effectiveInterval).toBe(3);
        expect(list[0].daysOverdue).toBe(5);
    });

    it('includes upcoming reminders with negative daysOverdue', async () => {
        // last log 1 day ago, interval 5 → not due, 4 days until due
        await entries.upsertEntry(makeEntry(daysAgo(1), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 5 },
                }),
            ],
            EditTools.JOT
        );
        const list = reminders.enabledReminders;
        expect(list).toHaveLength(1);
        expect(list[0].daysOverdue).toBe(-4);
        expect(list[0].isOverdue).toBe(false);
    });

    it('hides reminders dismissed today', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(8), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: {
                        enabled: true,
                        intervalDaysOverride: 3,
                        lastDismissed: today,
                    },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.enabledReminders).toEqual([]);
    });

    it('puts overdue items before upcoming ones, most-overdue first', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(10), ['a1'])); // overdue 7
        await entries.upsertEntry(makeEntry(daysAgo(5), ['a2'])); // overdue 2
        await entries.upsertEntry(makeEntry(daysAgo(1), ['a3'])); // upcoming, 2 days
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
                makeActivity('a2', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
                makeActivity('a3', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        expect(
            reminders.enabledReminders.map((r) => r.activity.id)
        ).toEqual(['a1', 'a2', 'a3']);
    });

    it('marks never-logged activity as overdue (cold start)', async () => {
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        const list = reminders.enabledReminders;
        expect(list).toHaveLength(1);
        expect(list[0].metrics.totalLogs).toBe(0);
        expect(list[0].daysOverdue).toBe(0);
        expect(list[0].isOverdue).toBe(true);
    });

    it('excludes activities with no interval available (1 log + auto)', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(30), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: null },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.enabledReminders).toEqual([]);
    });
});

describe('RemindersStore.dueCount', () => {
    it('counts only overdue/due-today items, not upcoming ones', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(10), ['a1'])); // overdue
        await entries.upsertEntry(makeEntry(daysAgo(10), ['a2'])); // overdue
        await entries.upsertEntry(makeEntry(daysAgo(1), ['a3'])); // upcoming
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
                makeActivity('a2', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
                makeActivity('a3', {
                    reminder: { enabled: true, intervalDaysOverride: 5 },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.enabledReminders).toHaveLength(3);
        expect(reminders.dueCount).toBe(2);
    });
});

describe('RemindersStore.dismissReminder', () => {
    it('sets lastDismissed to today and removes from enabled list', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(8), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.enabledReminders).toHaveLength(1);
        await reminders.dismissReminder('a1');
        expect(activities.getActivity('a1')?.reminder?.lastDismissed).toBe(
            today
        );
        expect(reminders.enabledReminders).toEqual([]);
    });

    it('is a no-op for activities without reminder config', async () => {
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        await reminders.dismissReminder('a1');
        expect(activities.getActivity('a1')?.reminder).toBeUndefined();
    });
});

describe('RemindersStore.dismissSuggestion', () => {
    it('marks the activity with a disabled reminder so it is not re-suggested', async () => {
        // strong biweekly cadence — would normally be suggested
        for (const d of [70, 56, 42, 28, 14]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a1']));
        }
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        expect(reminders.suggestedReminders).toHaveLength(1);
        await reminders.dismissSuggestion('a1');
        expect(activities.getActivity('a1')?.reminder).toEqual({
            enabled: false,
            intervalDaysOverride: null,
        });
        expect(reminders.suggestedReminders).toEqual([]);
    });

    it('is a no-op when the activity already has a reminder config', async () => {
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        await reminders.dismissSuggestion('a1');
        expect(activities.getActivity('a1')?.reminder).toEqual({
            enabled: true,
            intervalDaysOverride: 3,
        });
    });
});

describe('RemindersStore.suggestedReminders', () => {
    it('suggests an activity with a strong biweekly cadence', async () => {
        for (const d of [70, 56, 42, 28, 14]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a1']));
        }
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        const suggestions = reminders.suggestedReminders;
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].activity.id).toBe('a1');
        expect(suggestions[0].avgDaysBetween).toBe(14);
    });

    it('does not suggest when the user already configured a reminder', async () => {
        for (const d of [70, 56, 42, 28, 14]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a1']));
        }
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: false, intervalDaysOverride: null },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.suggestedReminders).toEqual([]);
    });

    it('does not suggest noisy cadences', async () => {
        // gaps: 1, 1, 100, 1 → CV ≈ 1.66 → not strong
        for (const d of [103, 102, 2, 1, 0]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a1']));
        }
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        expect(reminders.suggestedReminders).toEqual([]);
    });

    it('does not suggest when below the minimum-logs threshold', async () => {
        for (const d of [28, 14]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a1']));
        }
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        expect(reminders.suggestedReminders).toEqual([]);
    });

    it('sorts suggestions by avg cadence ascending', async () => {
        // a1: every 7 days
        for (const d of [35, 28, 21, 14, 7]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a1']));
        }
        // a2: every 14 days
        for (const d of [70, 56, 42, 28, 14]) {
            await entries.upsertEntry(makeEntry(daysAgo(d), ['a2']));
        }
        await activities.bulkImport(
            [makeActivity('a1'), makeActivity('a2')],
            EditTools.JOT
        );
        expect(reminders.suggestedReminders.map((s) => s.activity.id)).toEqual([
            'a1',
            'a2',
        ]);
    });
});

describe('RemindersStore.enableReminder', () => {
    it('sets a default enabled reminder on the activity', async () => {
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        await reminders.enableReminder('a1');
        expect(activities.getActivity('a1')?.reminder).toEqual({
            enabled: true,
            intervalDaysOverride: null,
        });
    });

    it('is a no-op for an unknown activity id', async () => {
        await reminders.enableReminder('does-not-exist');
        expect(activities.getActivity('does-not-exist')).toBeUndefined();
    });
});
