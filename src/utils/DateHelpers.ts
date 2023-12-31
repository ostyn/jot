import { format, parseISO } from 'date-fns';

export class DateHelpers {
    public static stringDateToDate(date: string) {
        return format(parseISO(date), 'MMMM d, yyyy');
    }
    public static stringDateToTime(date: string) {
        return format(parseISO(date), 'h:mm a');
    }
    public static dateToStringDate(date: Date) {
        return format(date, 'MMMM d, yyyy');
    }
    public static dateToStringTime(date: Date) {
        return format(date, 'h:mm a');
    }
    public static stringDateToWeekDay(date: string) {
        return format(parseISO(date), 'EEEE');
    }
}
