import { MovieFaceoffReplayState } from './types';

/**
 * Caches the result of a per-replay computation by replay reference. The
 * replay state is rebuilt from events on every change, so identity is a
 * safe key — same reference means same data.
 *
 * The cached value is returned by reference, so callers must treat it as
 * read-only. Mutating the returned array (.sort, .splice, .reverse) or its
 * elements will corrupt the cache for every other caller that follows.
 */
export function memoizeByReplay<T>(
    fn: (replay: MovieFaceoffReplayState) => T
): (replay: MovieFaceoffReplayState) => T {
    const cache = new WeakMap<MovieFaceoffReplayState, T>();
    return (replay) => {
        const cached = cache.get(replay);
        if (cached !== undefined) return cached;
        const result = fn(replay);
        cache.set(replay, result);
        return result;
    };
}
