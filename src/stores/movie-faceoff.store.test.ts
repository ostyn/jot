import { autorun } from 'mobx';
import { beforeEach, describe, expect, it } from 'vitest';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import { movieFaceoff } from './movie-faceoff.store';

function makeMovie(id: number, overrides: Partial<FaceoffMovie> = {}): FaceoffMovie {
    return {
        id,
        title: `Movie ${id}`,
        poster_path: `/poster-${id}.jpg`,
        release_date: '2020-01-01',
        ...overrides,
    };
}

beforeEach(async () => {
    await movieFaceoff.reset();
});

describe('MovieFaceoffStore.recordVote', () => {
    it('appends an event with winner/loser ids and returns the generated id', async () => {
        const id = await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        expect(typeof id).toBe('number');
        expect(movieFaceoff.allEvents).toHaveLength(1);
        expect(movieFaceoff.allEvents[0]).toMatchObject({
            id,
            winnerId: 1,
            loserId: 2,
            type: 'vote',
        });
    });

    it('upserts both movies into the store', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        expect(movieFaceoff.allMovies).toHaveLength(2);
        const titles = movieFaceoff.allMovies.map((m) => m.title).sort();
        expect(titles).toEqual(['Movie 1', 'Movie 2']);
    });

    it('stores targetId when provided', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2), 1);
        expect(movieFaceoff.allEvents[0].targetId).toBe(1);
    });

    it('omits targetId when not provided', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        expect(movieFaceoff.allEvents[0].targetId).toBeUndefined();
    });
});

describe('MovieFaceoffStore.deleteEvent', () => {
    it('removes the event from in-memory state', async () => {
        const id = await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.deleteEvent(id);
        expect(movieFaceoff.allEvents).toHaveLength(0);
    });

    it('leaves other events untouched', async () => {
        const firstId = await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.recordVote(makeMovie(3), makeMovie(4));
        await movieFaceoff.deleteEvent(firstId);
        expect(movieFaceoff.allEvents).toHaveLength(1);
        expect(movieFaceoff.allEvents[0].winnerId).toBe(3);
    });

    it('persists deletions across a refresh', async () => {
        const id = await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.deleteEvent(id);
        await movieFaceoff.refresh();
        expect(movieFaceoff.allEvents).toHaveLength(0);
    });
});

describe('MovieFaceoffStore exclude/restore', () => {
    it('excludeMovie sets excludedAt and updates the computed set', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.excludeMovie(1);
        expect(movieFaceoff.movieMap.get(1)?.excludedAt).toBeTruthy();
        expect(movieFaceoff.excludedMovieIds.has(1)).toBe(true);
        expect(movieFaceoff.excludedMovieIds.has(2)).toBe(false);
    });

    it('restoreMovie clears excludedAt', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.excludeMovie(1);
        await movieFaceoff.restoreMovie(1);
        expect(movieFaceoff.movieMap.get(1)?.excludedAt).toBeUndefined();
        expect(movieFaceoff.excludedMovieIds.has(1)).toBe(false);
    });

    it('excludeMovie is a no-op for unknown ids', async () => {
        await movieFaceoff.excludeMovie(999);
        expect(movieFaceoff.excludedMovieIds.size).toBe(0);
    });
});

describe('MovieFaceoffStore unseen', () => {
    it('markMovieUnseen sets unseenAt and updates the computed set', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.markMovieUnseen(1);
        expect(movieFaceoff.movieMap.get(1)?.unseenAt).toBeTruthy();
        expect(movieFaceoff.unseenMovieIds.has(1)).toBe(true);
    });

    it('markMoviesUnseen dedupes repeated ids', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.markMoviesUnseen([1, 1, 2, 2]);
        expect(movieFaceoff.unseenMovieIds).toEqual(new Set([1, 2]));
    });
});

describe('MovieFaceoffStore computed replayState', () => {
    it('reacts to vote updates', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        expect(movieFaceoff.replayState.ratings.get(1)?.winCount).toBe(1);

        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        expect(movieFaceoff.replayState.ratings.get(1)?.winCount).toBe(2);
    });

    it('reacts to exclusion (movie stays in ratings but excludedAt is set)', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.excludeMovie(1);
        expect(movieFaceoff.replayState.ratings.get(1)?.excludedAt).toBeTruthy();
    });

    it('triggers MobX autorun when allEvents changes', async () => {
        const observed: number[] = [];
        const dispose = autorun(() => {
            observed.push(movieFaceoff.replayState.events.length);
        });
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        dispose();
        // Initial run + one reaction after the recordVote
        expect(observed[0]).toBe(0);
        expect(observed[observed.length - 1]).toBe(1);
    });

    it('honors targetId when rebuilding the manualList (regression lock)', async () => {
        // Three vanilla votes establish manualList = [1, 2, 3, 4]
        // (each winner lands above its loser via push-based insert).
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.recordVote(makeMovie(2), makeMovie(3));
        await movieFaceoff.recordVote(makeMovie(3), makeMovie(4));
        // Targeted re-rank of movie 1: vote says pivot=3 beats target=1.
        // The targetId branch moves only the target; pivot 3 stays at its slot.
        // Expected: 1 drops to just below 3 → [2, 3, 1, 4].
        await movieFaceoff.recordVote(makeMovie(3), makeMovie(1), 1);
        expect(movieFaceoff.replayState.manualList).toEqual([2, 3, 1, 4]);
    });

    it('tracks excludedAt and unseenAt independently on the same movie', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.excludeMovie(1);
        await movieFaceoff.markMovieUnseen(1);
        const movie = movieFaceoff.movieMap.get(1);
        expect(movie?.excludedAt).toBeTruthy();
        expect(movie?.unseenAt).toBeTruthy();
        expect(movieFaceoff.excludedMovieIds.has(1)).toBe(true);
        expect(movieFaceoff.unseenMovieIds.has(1)).toBe(true);
    });
});

describe('MovieFaceoffStore.reset', () => {
    it('clears both events and movies', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        expect(movieFaceoff.allEvents).toHaveLength(1);
        await movieFaceoff.reset();
        expect(movieFaceoff.allEvents).toHaveLength(0);
        expect(movieFaceoff.allMovies).toHaveLength(0);
    });

    it('persists across a refresh', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.reset();
        await movieFaceoff.refresh();
        expect(movieFaceoff.allEvents).toHaveLength(0);
        expect(movieFaceoff.allMovies).toHaveLength(0);
    });
});

describe('MovieFaceoffStore.importData', () => {
    it('appends to existing data when overwrite is false', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.importData(
            {
                movies: [
                    {
                        id: 10,
                        title: 'Imported 10',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                ],
                events: [
                    {
                        id: 1000,
                        createdAt: new Date().toISOString(),
                        type: 'vote',
                        winnerId: 10,
                        loserId: 1,
                    },
                ],
            },
            { overwrite: false }
        );

        const movieIds = movieFaceoff.allMovies.map((m) => m.id).sort((a, b) => a - b);
        expect(movieIds).toEqual([1, 2, 10]);
        expect(movieFaceoff.allEvents).toHaveLength(2);
    });

    it('replaces existing data when overwrite is true', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        const now = new Date().toISOString();
        await movieFaceoff.importData(
            {
                movies: [
                    { id: 10, title: 'Imported 10', createdAt: now, updatedAt: now },
                    { id: 11, title: 'Imported 11', createdAt: now, updatedAt: now },
                ],
                events: [
                    {
                        id: 1000,
                        createdAt: now,
                        type: 'vote',
                        winnerId: 10,
                        loserId: 11,
                    },
                ],
            },
            { overwrite: true }
        );

        const movieIds = movieFaceoff.allMovies.map((m) => m.id).sort((a, b) => a - b);
        expect(movieIds).toEqual([10, 11]);
        expect(movieFaceoff.allEvents).toHaveLength(1);
        expect(movieFaceoff.allEvents[0].winnerId).toBe(10);
    });

    it('handles undefined data with overwrite=true (clears everything)', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.importData(undefined, { overwrite: true });
        expect(movieFaceoff.allEvents).toHaveLength(0);
        expect(movieFaceoff.allMovies).toHaveLength(0);
    });

    it('handles undefined data with overwrite=false (no-op)', async () => {
        await movieFaceoff.recordVote(makeMovie(1), makeMovie(2));
        await movieFaceoff.importData(undefined, { overwrite: false });
        expect(movieFaceoff.allEvents).toHaveLength(1);
        expect(movieFaceoff.allMovies).toHaveLength(2);
    });
});
