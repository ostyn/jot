import {
    MovieFaceoffEvent,
    MovieFaceoffMovie,
} from '../../interfaces/movie-faceoff.interface';
import {
    buildMovieFaceoffReplayState,
    MovieFaceoffRankingAlgorithm,
    MovieFaceoffReplayState,
} from '../../utils/movie-faceoff-rankings';

/** Tuple shorthand for a vote event: [winnerId, loserId, targetId?] */
export type VoteTuple = [number, number, number?];

const EPOCH = Date.UTC(2024, 0, 1);

export function makeMovie(
    id: number,
    overrides: Partial<MovieFaceoffMovie> = {}
): MovieFaceoffMovie {
    return {
        id,
        title: `Movie ${id}`,
        createdAt: new Date(EPOCH).toISOString(),
        updatedAt: new Date(EPOCH).toISOString(),
        ...overrides,
    };
}

export function makeEvent(
    id: number,
    winnerId: number,
    loserId: number,
    overrides: Partial<MovieFaceoffEvent> = {}
): MovieFaceoffEvent {
    return {
        id,
        createdAt: new Date(EPOCH + id * 1000).toISOString(),
        type: 'vote',
        winnerId,
        loserId,
        ...overrides,
    };
}

/** Build events from vote tuples with auto-incrementing id + createdAt. */
export function makeEvents(votes: VoteTuple[]): MovieFaceoffEvent[] {
    return votes.map(([winnerId, loserId, targetId], index) =>
        makeEvent(index + 1, winnerId, loserId, targetId !== undefined ? { targetId } : {})
    );
}

/** Collect all movie ids referenced in a vote list. */
export function movieIdsFromVotes(votes: VoteTuple[]): number[] {
    const ids = new Set<number>();
    for (const [winner, loser] of votes) {
        ids.add(winner);
        ids.add(loser);
    }
    return [...ids];
}

/**
 * Build a replay state from vote tuples. Auto-generates MovieFaceoffMovie
 * records for every id that appears in the votes.
 */
export function buildReplayFromVotes(votes: VoteTuple[]) {
    const events = makeEvents(votes);
    const movies = movieIdsFromVotes(votes).map((id) => makeMovie(id));
    return buildMovieFaceoffReplayState(events, movies);
}

/** Convenience: run an algorithm and return just the ranked ids. */
export function rankedIds(
    state: MovieFaceoffReplayState,
    algorithm: MovieFaceoffRankingAlgorithm,
    primaryAlgorithms?: readonly MovieFaceoffRankingAlgorithm[]
): number[] {
    return algorithm.rank(state, primaryAlgorithms).map((m) => m.id);
}
