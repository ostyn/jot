import { format } from 'date-fns';
import { action, computed, makeObservable } from 'mobx';
import { Activity } from '../interfaces/activity.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';
import {
    ActivityFrequencyMetrics,
    getActivityFrequencyMetrics,
    isReminderDue,
} from '../utils/activity-frequency';
import { activities } from './activities.store';

export interface DueReminder {
    activity: Activity;
    metrics: ActivityFrequencyMetrics;
    effectiveInterval: number;
    daysOverdue: number;
}

class RemindersStore {
    constructor() {
        makeObservable(this);
    }

    @computed
    public get dueReminders(): DueReminder[] {
        const now = new Date();
        const stats: Map<string, StatsActivityEntry> = activities.stats;
        const due: DueReminder[] = [];
        for (const activity of activities.allVisibleActivities) {
            if (!activity.reminder?.enabled) continue;
            const metrics = getActivityFrequencyMetrics(
                stats.get(activity.id),
                now
            );
            if (!isReminderDue(activity.reminder, metrics, now)) continue;
            const interval =
                activity.reminder.intervalDaysOverride ??
                metrics.avgDaysBetween;
            if (interval == null) continue;
            due.push({
                activity,
                metrics,
                effectiveInterval: interval,
                daysOverdue:
                    metrics.daysSinceLast == null
                        ? 0
                        : Math.max(0, metrics.daysSinceLast - interval),
            });
        }
        due.sort((a, b) => b.daysOverdue - a.daysOverdue);
        return due;
    }

    @computed
    public get dueCount(): number {
        return this.dueReminders.length;
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
