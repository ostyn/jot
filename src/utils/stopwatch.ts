class Stopwatch {
    private starts = new Map<string, number>();

    start(key: string) {
        this.starts.set(key, performance.now());
    }

    stop(key: string): number {
        const start = this.starts.get(key);
        if (start === undefined) return 0;
        this.starts.delete(key);
        return performance.now() - start;
    }

    stopAndLog(key: string, label = key): number {
        const elapsed = this.stop(key);
        console.log(`[timer] ${label}: ${elapsed.toFixed(1)}ms`);
        return elapsed;
    }
}

export const stopwatch = new Stopwatch();
