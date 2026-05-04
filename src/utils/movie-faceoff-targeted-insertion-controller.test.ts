import { describe, expect, it } from 'vitest';
import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import {
    MovieFaceoffTargetedInsertionAdapter,
    MovieFaceoffTargetedInsertionController,
} from './movie-faceoff-targeted-insertion-controller';
import { FaceoffPair, TargetedInsertionState } from './movie-faceoff-types';

function makeMovie(id: number, title = `Movie ${id}`): FaceoffMovie {
    return { id, title };
}

function makeRanked(ids: number[]): MovieFaceoffRankedMovie[] {
    const now = new Date().toISOString();
    return ids.map((id) => ({
        id,
        title: `Movie ${id}`,
        createdAt: now,
        updatedAt: now,
        rating: 1500,
        winCount: 0,
        lossCount: 0,
    }));
}

function makeAdapter(overrides: Partial<MovieFaceoffTargetedInsertionAdapter> = {}) {
    const calls = {
        displayNewPair: 0,
        upsertMoviesMetadata: 0 as number,
        statusMessages: [] as string[],
        errorMessages: [] as string[],
        moviesSet: [] as FaceoffPair[],
    };

    let session: TargetedInsertionState | null = null;

    const adapter: MovieFaceoffTargetedInsertionAdapter = {
        getSession: () => session,
        setSession: (next) => {
            session = next;
        },
        setPendingTargetMovieId: () => {},
        getRankedSnapshotForSort: (_: MovieFaceoffSortMode) => makeRanked([1, 2, 3]),
        hasPriorVotes: () => false,
        setModeIdSilent: () => {},
        setStatusMessage: (message) => {
            calls.statusMessages.push(message);
        },
        setErrorMessage: (message) => {
            calls.errorMessages.push(message);
        },
        setMovies: (movies) => {
            calls.moviesSet.push(movies);
        },
        syncPairToUrl: () => {},
        displayNewPair: async () => {
            calls.displayNewPair++;
        },
        upsertMoviesMetadata: async () => {
            calls.upsertMoviesMetadata++;
        },
        fetchMovie: async (id) => makeMovie(id),
        ...overrides,
    };

    return {
        adapter,
        calls,
        get session() {
            return session;
        },
    };
}

describe('MovieFaceoffTargetedInsertionController.start', () => {
    it('skips pivot and goes straight to pinned when target has prior votes', async () => {
        const fixture = makeAdapter({ hasPriorVotes: () => true });
        const controller = new MovieFaceoffTargetedInsertionController(fixture.adapter);

        await controller.start(makeMovie(99));

        expect(fixture.session?.phase).toBe('pinned');
        expect(fixture.session?.complete).toBe(true);
        expect(fixture.calls.displayNewPair).toBe(1);
        // No pivot pair was forced — route's displayNewPair handles pinned pairing.
        expect(fixture.calls.moviesSet).toHaveLength(0);
    });

    it('starts in pivot phase when target has no prior votes', async () => {
        const fixture = makeAdapter();
        const controller = new MovieFaceoffTargetedInsertionController(fixture.adapter);

        await controller.start(makeMovie(99));

        expect(fixture.session?.phase).toBe('pivot');
        expect(fixture.session?.complete).toBe(false);
        expect(fixture.session?.pivotMovie).not.toBeNull();
        // Pivot phase forces the initial pair via setMovies.
        expect(fixture.calls.moviesSet).toHaveLength(1);
        expect(fixture.calls.displayNewPair).toBe(0);
    });

    it('falls back to pinned phase when there are no candidates to pivot against', async () => {
        const fixture = makeAdapter({
            getRankedSnapshotForSort: () => [],
        });
        const controller = new MovieFaceoffTargetedInsertionController(fixture.adapter);

        await controller.start(makeMovie(99));

        expect(fixture.session?.phase).toBe('pinned');
        expect(fixture.calls.errorMessages.at(-1)).toMatch(
            /at least one ranked movie/i
        );
    });
});

describe('MovieFaceoffTargetedInsertionController pivot→pinned transition', () => {
    it('transitions to pinned phase once pivot converges instead of clearing', async () => {
        // Use a deterministic ranked snapshot so the pivot completes after
        // a known number of votes. With a 3-movie list and "target loses"
        // every time, low marches up to high in a couple of rounds.
        const fixture = makeAdapter({
            getRankedSnapshotForSort: () => makeRanked([1, 2, 3]),
        });
        const controller = new MovieFaceoffTargetedInsertionController(fixture.adapter);
        await controller.start(makeMovie(99));

        // Drive votes until the controller transitions to pinned phase.
        let safety = 10;
        while (
            fixture.session?.phase === 'pivot' &&
            !fixture.session?.complete &&
            safety-- > 0
        ) {
            await controller.advanceAfterVote(false);
        }

        expect(fixture.session?.phase).toBe('pinned');
        expect(fixture.session?.targetMovie.id).toBe(99);
        // The transition itself triggers a displayNewPair so the route can
        // pair target-vs-smart.
        expect(fixture.calls.displayNewPair).toBeGreaterThanOrEqual(1);
    });
});

describe('MovieFaceoffTargetedInsertionController.advanceAfterVote in pinned phase', () => {
    it('returns false so the route can run its normal post-vote flow', async () => {
        const fixture = makeAdapter({ hasPriorVotes: () => true });
        const controller = new MovieFaceoffTargetedInsertionController(fixture.adapter);
        await controller.start(makeMovie(99));

        const handled = await controller.advanceAfterVote(true);
        expect(handled).toBe(false);
        // Session stays put — no clearing.
        expect(fixture.session?.phase).toBe('pinned');
    });
});

describe('MovieFaceoffTargetedInsertionController.cancel', () => {
    it('clears the session and emits an "Unpinned" status', async () => {
        const fixture = makeAdapter({ hasPriorVotes: () => true });
        const controller = new MovieFaceoffTargetedInsertionController(fixture.adapter);
        await controller.start(makeMovie(99, 'Portrait of Jennie'));

        controller.cancel();

        expect(fixture.session).toBeNull();
        expect(fixture.calls.statusMessages.at(-1)).toBe('Unpinned Portrait of Jennie.');
    });
});
