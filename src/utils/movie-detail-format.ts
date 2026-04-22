export function formatDate(date?: string): string {
    if (!date) return 'Unknown';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function formatRuntime(runtime?: number): string {
    if (!runtime) return '';
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    if (!hours) return `${minutes}m`;
    if (!minutes) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

export function formatVoteAverage(voteAverage?: number, voteCount?: number): string {
    if (!voteAverage) return '';
    const score = voteAverage.toFixed(1);
    if (!voteCount) return `TMDB ${score}/10`;
    return `TMDB ${score}/10 (${voteCount.toLocaleString()})`;
}

export function formatWinRate(winCount: number, lossCount: number): string {
    const total = winCount + lossCount;
    if (!total) return '—';
    return `${Math.round((winCount / total) * 100)}%`;
}
