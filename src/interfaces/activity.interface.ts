export interface ActivityReminderConfig {
    enabled: boolean;
    intervalDaysOverride: number | null;
    lastDismissed?: string;
}

export interface Activity {
    category: string | undefined;
    name: any;
    emoji: any;
    updated: Date;
    created: Date;
    isArchived: boolean;
    id: string;
    reminder?: ActivityReminderConfig;
}
