import { ReadingItem } from '../interfaces/reading-item.interface';

export function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

export function hostnameFromUrl(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (_error) {
        return url;
    }
}

export function statusLabel(item: ReadingItem): string | undefined {
    if (item.fetchState === 'pending') return 'Loading preview';
    if (item.httpStatus === 404) return '404';
    if (item.httpStatus && item.httpStatus !== 200) return `${item.httpStatus}`;
    if (item.fetchState === 'failed') return 'Preview unavailable';
    return undefined;
}
