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

describe('RemindersStore.dueReminders', () => {
    it('is empty when no activities have reminders', async () => {
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        await entries.upsertEntry(makeEntry(daysAgo(20), ['a1']));
        expect(reminders.dueReminders).toEqual([]);
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
        expect(reminders.dueReminders).toEqual([]);
    });

    it('surfaces a due reminder using avg cadence', async () => {
        // 3 logs spaced ~5 days apart, last was 8 days ago → due
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
        const due = reminders.dueReminders;
        expect(due).toHaveLength(1);
        expect(due[0].activity.id).toBe('a1');
        expect(due[0].effectiveInterval).toBe(5);
        expect(due[0].daysOverdue).toBe(3);
    });

    it('respects user override over computed avg', async () => {
        // logs 8 days ago, override = 3 → daysSinceLast 8 >= 3 → due, overdue 5
        await entries.upsertEntry(makeEntry(daysAgo(8), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        const due = reminders.dueReminders;
        expect(due).toHaveLength(1);
        expect(due[0].effectiveInterval).toBe(3);
        expect(due[0].daysOverdue).toBe(5);
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
        expect(reminders.dueReminders).toEqual([]);
    });

    it('sorts most-overdue first', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(10), ['a1']));
        await entries.upsertEntry(makeEntry(daysAgo(5), ['a2']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
                makeActivity('a2', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        const due = reminders.dueReminders;
        expect(due.map((d) => d.activity.id)).toEqual(['a1', 'a2']);
    });

    it('fires for never-logged activity with manual override (cold start)', async () => {
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        const due = reminders.dueReminders;
        expect(due).toHaveLength(1);
        expect(due[0].metrics.totalLogs).toBe(0);
        expect(due[0].daysOverdue).toBe(0);
    });

    it('does not fire when auto cadence enabled but only 1 log (no avg available)', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(30), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: null },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.dueReminders).toEqual([]);
    });
});

describe('RemindersStore.dueCount', () => {
    it('matches dueReminders.length', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(10), ['a1']));
        await entries.upsertEntry(makeEntry(daysAgo(10), ['a2']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
                makeActivity('a2', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.dueCount).toBe(2);
    });
});

describe('RemindersStore.dismissReminder', () => {
    it('sets lastDismissed to today and removes from due list', async () => {
        await entries.upsertEntry(makeEntry(daysAgo(8), ['a1']));
        await activities.bulkImport(
            [
                makeActivity('a1', {
                    reminder: { enabled: true, intervalDaysOverride: 3 },
                }),
            ],
            EditTools.JOT
        );
        expect(reminders.dueReminders).toHaveLength(1);
        await reminders.dismissReminder('a1');
        expect(activities.getActivity('a1')?.reminder?.lastDismissed).toBe(
            today
        );
        expect(reminders.dueReminders).toEqual([]);
    });

    it('is a no-op for activities without reminder config', async () => {
        await activities.bulkImport([makeActivity('a1')], EditTools.JOT);
        await reminders.dismissReminder('a1');
        expect(activities.getActivity('a1')?.reminder).toBeUndefined();
    });
});
