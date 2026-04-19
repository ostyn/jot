import { describe, expect, it } from 'vitest';
import {
    buildReplayFromVotes,
    makeEvent,
    makeMovie,
} from '../../test/fixtures/movie-faceoff';
import { buildMovieFaceoffReplayState } from './replay-state';

describe('buildMovieFaceoffReplayState', () => {
    describe('with no events', () => {
        it('returns empty ratings and manual list', () => {
            const state = buildReplayFromVotes([]);
            expect(state.ratings.size).toBe(0);
            expect(state.manualList).toEqual([]);
            expect(state.beatMap.size).toBe(0);
            expect(state.decisiveMovieIds.size).toBe(0);
        });

        it('still populates movieMap from provided movies', () => {
            const movies = [makeMovie(1), makeMovie(2)];
            const state = buildMovieFaceoffReplayState([], movies);
            expect(state.movieMap.size).toBe(2);
            expect(state.movieMap.get(1)?.title).toBe('Movie 1');
        });
    });

    describe('with a single vote', () => {
        it('marks both movies as decisive', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            expect(state.decisiveMovieIds.has(1)).toBe(true);
            expect(state.decisiveMovieIds.has(2)).toBe(true);
        });

        it('records a single win and loss', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            expect(state.ratings.get(1)?.winCount).toBe(1);
            expect(state.ratings.get(1)?.lossCount).toBe(0);
            expect(state.ratings.get(2)?.winCount).toBe(0);
            expect(state.ratings.get(2)?.lossCount).toBe(1);
        });

        it('moves winner above 1500 and loser below 1500', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            const winner = state.ratings.get(1)!;
            const loser = state.ratings.get(2)!;
            expect(winner.rating).toBeGreaterThan(1500);
            expect(loser.rating).toBeLessThan(1500);
            // Symmetric around 1500 for equal-rated opponents
            expect(winner.rating - 1500).toBeCloseTo(1500 - loser.rating, 10);
        });

        it('applies the K=32 Elo delta for equal-rated opponents', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            // expectedWinner = 0.5 for equal ratings; delta = 32 * (1 - 0.5) = 16
            expect(state.ratings.get(1)!.rating).toBeCloseTo(1516, 10);
            expect(state.ratings.get(2)!.rating).toBeCloseTo(1484, 10);
        });

        it('records the beat relationship', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            expect(state.beatMap.get(1)?.has(2)).toBe(true);
            expect(state.beatMap.has(2)).toBe(false);
        });

        it('places both movies in manualList with winner first', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            expect(state.manualList).toEqual([1, 2]);
        });
    });

    describe('event ordering', () => {
        it('sorts by id first, then createdAt', () => {
            // Events intentionally out of order: id 2 has earlier createdAt than id 1
            const events = [
                makeEvent(2, 1, 2, { createdAt: '2024-02-01T00:00:00.000Z' }),
                makeEvent(1, 3, 4, { createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const movies = [makeMovie(1), makeMovie(2), makeMovie(3), makeMovie(4)];
            const state = buildMovieFaceoffReplayState(events, movies);
            // Sorted result: id=1 first, then id=2
            expect(state.events[0].id).toBe(1);
            expect(state.events[1].id).toBe(2);
        });

        it('falls back to createdAt when ids are missing', () => {
            const events = [
                makeEvent(1, 1, 2, { id: undefined, createdAt: '2024-02-01T00:00:00.000Z' }),
                makeEvent(2, 3, 4, { id: undefined, createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const movies = [makeMovie(1), makeMovie(2), makeMovie(3), makeMovie(4)];
            const state = buildMovieFaceoffReplayState(events, movies);
            // Sorted by createdAt ascending
            expect(state.events[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
            expect(state.events[1].createdAt).toBe('2024-02-01T00:00:00.000Z');
        });

        it('filters out non-vote events', () => {
            const events = [
                makeEvent(1, 1, 2),
                { ...makeEvent(2, 3, 4), type: 'skip' as unknown as 'vote' },
            ];
            const movies = [makeMovie(1), makeMovie(2), makeMovie(3), makeMovie(4)];
            const state = buildMovieFaceoffReplayState(events, movies);
            expect(state.events).toHaveLength(1);
        });

        it('does not mutate the caller events array', () => {
            const events = [
                makeEvent(2, 1, 2),
                makeEvent(1, 3, 4),
            ];
            const snapshot = events.map((e) => ({ ...e }));
            const movies = [makeMovie(1), makeMovie(2), makeMovie(3), makeMovie(4)];
            buildMovieFaceoffReplayState(events, movies);
            expect(events).toEqual(snapshot);
        });
    });

    describe('insertManualRank without targetId', () => {
        it('single vote places winner above loser', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            expect(state.manualList).toEqual([1, 2]);
        });

        it('already-correct order is a no-op', () => {
            // 1 > 2 established, then 1 beats 2 again
            const state = buildReplayFromVotes([[1, 2], [1, 2]]);
            expect(state.manualList).toEqual([1, 2]);
        });

        it('upset moves winner above loser (push-based)', () => {
            // 1 > 2 established, then 2 beats 1 → 2 moves above 1
            const state = buildReplayFromVotes([[1, 2], [2, 1]]);
            expect(state.manualList).toEqual([2, 1]);
        });

        it('new loser appends to end', () => {
            // 1 already in list (from vote 1); now 1 beats new movie 3
            const state = buildReplayFromVotes([[1, 2], [1, 3]]);
            expect(state.manualList).toEqual([1, 2, 3]);
        });

        it('new winner inserts above existing loser', () => {
            // 2 is already somewhere; new movie 3 beats 2
            const state = buildReplayFromVotes([[1, 2], [3, 2]]);
            // manualList after vote 1: [1, 2]
            // vote 2: 3 (new) beats 2 (at index 1) → insert 3 at index 1
            expect(state.manualList).toEqual([1, 3, 2]);
        });
    });

    describe('insertManualRank with targetId (first placement)', () => {
        it('places target above pivot when target wins', () => {
            // Build list of 3 movies first, then vote with targetId=4 (new) winning against 2
            const state = buildReplayFromVotes([
                [1, 2],
                [2, 3],
                [4, 2, 4], // targetId=4: target wins against pivot 2
            ]);
            // After first two: [1, 2, 3]. Then target=4 beats pivot=2 → 4 inserts at 2's slot.
            // 2 stays at its position relative to others.
            expect(state.manualList).toEqual([1, 4, 2, 3]);
        });

        it('places target below pivot when target loses', () => {
            const state = buildReplayFromVotes([
                [1, 2],
                [2, 3],
                [1, 4, 4], // targetId=4: target (loser) loses to pivot (winner) 1
            ]);
            // After first two: [1, 2, 3]. Target=4 loses to pivot=1 → 4 inserts right after 1.
            expect(state.manualList).toEqual([1, 4, 2, 3]);
        });

        it('appends pivot when pivot not yet in list', () => {
            // New target and new pivot, both absent — pivot gets appended, target placed around it
            const state = buildReplayFromVotes([[10, 20, 10]]);
            // Both new; targetId=10 is the winner; pivot=20 gets appended first then target inserted above it.
            expect(state.manualList).toEqual([10, 20]);
        });
    });

    describe('insertManualRank with targetId (re-ranking)', () => {
        it('moves target without dragging pivot up', () => {
            // Set up list [1, 2, 3, 4, 5] where 5 will be re-ranked
            const state = buildReplayFromVotes([
                [1, 2],
                [1, 3],
                [1, 4],
                [1, 5],
                [2, 3],
                [3, 4],
                [4, 5],
                // manualList now [1, 2, 3, 4, 5]
                [4, 1, 1], // re-rank 1: 1 loses to pivot 4 → 1 moves below 4, 4 stays put
            ]);
            // Pivot 4 stays at index 3. Target 1 moves from index 0 to index 4.
            expect(state.manualList).toEqual([2, 3, 4, 1, 5]);
        });

        it('does not drag pivot up when pivot was below target', () => {
            // [1, 2, 3] with 1 as target re-ranking below 3
            const state = buildReplayFromVotes([
                [1, 2],
                [2, 3],
                // list is [1, 2, 3]
                [3, 1, 1], // targetId=1; pivot=3 (winner) beats target=1 (loser)
            ]);
            // Desired: target 1 moves below pivot 3. Pivot 3 stays at index 2.
            expect(state.manualList).toEqual([2, 3, 1]);
        });

        it('target wins against pivot (target moves up to pivot slot)', () => {
            const state = buildReplayFromVotes([
                [1, 2],
                [2, 3],
                // list is [1, 2, 3]
                [3, 1, 3], // targetId=3; target (3) beats pivot (1)
            ]);
            // Target 3 moves to pivot 1's slot; pivot 1 stays at that position + 1.
            expect(state.manualList).toEqual([3, 1, 2]);
        });
    });

    describe('movieMap sync', () => {
        it('includes metadata from the provided movies array', () => {
            const events = [makeEvent(1, 1, 2)];
            const movies = [
                makeMovie(1, { title: 'Star Wars', posterPath: '/sw.jpg' }),
                makeMovie(2, { title: 'Empire Strikes Back' }),
            ];
            const state = buildMovieFaceoffReplayState(events, movies);
            expect(state.ratings.get(1)?.title).toBe('Star Wars');
            expect(state.ratings.get(1)?.posterPath).toBe('/sw.jpg');
            expect(state.ratings.get(2)?.title).toBe('Empire Strikes Back');
        });

        it('falls back to a placeholder title when the movie is missing', () => {
            const events = [makeEvent(1, 1, 2)];
            const movies = [makeMovie(1)];
            const state = buildMovieFaceoffReplayState(events, movies);
            expect(state.ratings.get(2)?.title).toBe('Movie 2');
        });

        it('carries excludedAt and unseenAt into ratings', () => {
            const events = [makeEvent(1, 1, 2)];
            const movies = [
                makeMovie(1, { excludedAt: '2024-05-01T00:00:00.000Z' }),
                makeMovie(2, { unseenAt: '2024-05-02T00:00:00.000Z' }),
            ];
            const state = buildMovieFaceoffReplayState(events, movies);
            expect(state.ratings.get(1)?.excludedAt).toBe('2024-05-01T00:00:00.000Z');
            expect(state.ratings.get(2)?.unseenAt).toBe('2024-05-02T00:00:00.000Z');
        });
    });

    describe('Glicko integration', () => {
        it('assigns Glicko ratings and reduces RD below the default after a vote', () => {
            const state = buildReplayFromVotes([[1, 2]]);
            const winner = state.ratings.get(1)!;
            const loser = state.ratings.get(2)!;
            expect(winner.glickoRating).toBeGreaterThan(1500);
            expect(loser.glickoRating).toBeLessThan(1500);
            // Default RD is 350; after a vote uncertainty decreases
            expect(winner.ratingDeviation).toBeLessThan(350);
            expect(loser.ratingDeviation).toBeLessThan(350);
        });
    });
});
