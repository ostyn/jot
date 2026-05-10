import { format } from 'date-fns';
import { action, computed, makeObservable } from 'mobx';
import { Activity } from '../interfaces/activity.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';
import {
    ActivityFrequencyMetrics,
    getActivityFrequencyMetrics,
    getCadenceRegularity,
    getReminderStatus,
} from '../utils/activity-frequency';
import { activities } from './activities.store';

export interface ReminderStatus {
    activity: Activity;
    metrics: ActivityFrequencyMetrics;
    effectiveInterval: number;
    // positive = overdue by N days, 0 = due today, negative = N days until due
    daysOverdue: number;
    isOverdue: boolean;
}

export interface SuggestedReminder {
    activity: Activity;
    avgDaysBetween: number;
}

class RemindersStore {
    constructor() {
        makeObservable(this);
    }

    // All activities with an enabled reminder that haven't been dismissed today.
    // Sorted with overdue/due-today first (most-overdue first), upcoming after
    // (closest to due first).
    @computed
    public get enabledReminders(): ReminderStatus[] {
        const now = new Date();
        const stats: Map<string, StatsActivityEntry> = activities.stats;
        const result: ReminderStatus[] = [];
        for (const activity of activities.allVisibleActivities) {
            const reminder = activity.reminder;
            if (!reminder?.enabled) continue;
            const metrics = getActivityFrequencyMetrics(
                stats.get(activity.id),
                now
            );
            const status = getReminderStatus(reminder, metrics, now);
            if (!status || status.dismissedToday) continue;
            result.push({
                activity,
                metrics,
                effectiveInterval: status.interval,
                daysOverdue: status.daysOverdue,
                isOverdue: status.isOverdue,
            });
        }
        result.sort((a, b) => {
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
            return b.daysOverdue - a.daysOverdue;
        });
        return result;
    }

    @computed
    public get dueCount(): number {
        return this.enabledReminders.filter((r) => r.isOverdue).length;
    }

    // Activities the user has never decided about (reminder undefined) that
    // show a strong, regular cadence in the entry history. A disabled reminder
    // means the user has explicitly opted out, so we don't re-suggest.
    @computed
    public get suggestedReminders(): SuggestedReminder[] {
        const stats: Map<string, StatsActivityEntry> = activities.stats;
        const suggestions: SuggestedReminder[] = [];
        for (const activity of activities.allVisibleActivities) {
            if (activity.reminder !== undefined) continue;
            const regularity = getCadenceRegularity(stats.get(activity.id));
            if (!regularity?.isStrong) continue;
            suggestions.push({
                activity,
                avgDaysBetween: regularity.avgDaysBetween,
            });
        }
        suggestions.sort((a, b) => a.avgDaysBetween - b.avgDaysBetween);
        return suggestions;
    }

    @action.bound
    public async enableReminder(activityId: string) {
        const activity = activities.getActivity(activityId);
        if (!activity) return;
        await activities.updateActivity({
            ...activity,
            reminder: { enabled: true, intervalDaysOverride: null },
        });
    }

    // Dismiss a suggestion: record an explicit opt-out so we never re-suggest
    // this activity. The user can still flip the toggle on in the activity-edit
    // sheet later.
    @action.bound
    public async dismissSuggestion(activityId: string) {
        const activity = activities.getActivity(activityId);
        if (!activity || activity.reminder !== undefined) return;
        await activities.updateActivity({
            ...activity,
            reminder: { enabled: false, intervalDaysOverride: null },
        });
    }

    @action.bound
    public async dismissReminder(activityId: string) {
        const activity = activities.getActivity(activityId);
        if (!activity?.reminder) return;
        const todayISO = format(new Date(), 'yyyy-MM-dd');
        await activities.updateActivity({
            ...activity,
            reminder: { ...activity.reminder, lastDismissed: todayISO },
        });
    }
}

export const reminders = new RemindersStore();
