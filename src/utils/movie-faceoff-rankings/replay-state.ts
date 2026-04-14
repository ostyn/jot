import {
    MovieFaceoffEvent,
    MovieFaceoffMovie,
    MovieFaceoffRankedMovie,
} from '../../interfaces/movie-faceoff.interface';
import { BeatMap, MovieFaceoffReplayState } from './types';

function syncRankedMovieMetadata(
    movieId: number,
    movieMap: Map<number, MovieFaceoffMovie>,
    ratings: Map<number, MovieFaceoffRankedMovie>
) {
    if (!ratings.has(movieId)) {
        const movie = movieMap.get(movieId);
        ratings.set(movieId, {
            id: movieId,
            title: movie?.title || `Movie ${movieId}`,
            posterPath: movie?.posterPath,
            releaseDate: movie?.releaseDate,
            excludedAt: movie?.excludedAt,
            unseenAt: movie?.unseenAt,
            createdAt: movie?.createdAt || new Date(0).toISOString(),
            updatedAt: movie?.updatedAt || new Date(0).toISOString(),
            rating: 1500,
            glickoRating: 1500,
            winCount: 0,
            lossCount: 0,
            ratingDeviation: 350, // Glicko default RD (high uncertainty)
            ratingVolatility: 0.06, // Glicko default volatility
        });
        return ratings.get(movieId)!;
    }

    const current = ratings.get(movieId)!;
    const movie = movieMap.get(movieId);
    if (!movie) return current;

    current.title = movie.title;
    current.posterPath = movie.posterPath;
    current.releaseDate = movie.releaseDate;
    current.excludedAt = movie.excludedAt;
    current.unseenAt = movie.unseenAt;
    current.createdAt = movie.createdAt;
    current.updatedAt = movie.updatedAt;
    return current;
}

function updateGlickoRatings(winner: MovieFaceoffRankedMovie, loser: MovieFaceoffRankedMovie) {
    const Q = Math.log(10) / 400;
    const MIN_RD = 30;
    const MAX_RD = 350;

    const applyResult = (
        player: MovieFaceoffRankedMovie,
        opponent: MovieFaceoffRankedMovie,
        score: 0 | 1
    ) => {
        const rating = player.glickoRating ?? 1500;
        const opponentRating = opponent.glickoRating ?? 1500;
        const rd = Math.max(player.ratingDeviation || MAX_RD, MIN_RD);
        const opponentRD = Math.max(opponent.ratingDeviation || MAX_RD, MIN_RD);

        const g = 1 / Math.sqrt(1 + (3 * Q * Q * opponentRD * opponentRD) / (Math.PI * Math.PI));
        const expected = 1 / (1 + 10 ** ((-g * (rating - opponentRating)) / 400));
        const dSquared = 1 / (Q * Q * g * g * expected * (1 - expected));
        const inverseVariance = 1 / (rd * rd) + 1 / dSquared;
        const newRating = rating + (Q / inverseVariance) * g * (score - expected);
        const newRD = Math.sqrt(1 / inverseVariance);

        player.glickoRating = newRating;
        player.ratingDeviation = Math.min(Math.max(newRD, MIN_RD), MAX_RD);
    };

    applyResult(winner, loser, 1);
    applyResult(loser, winner, 0);
}

function insertManualRank(list: number[], winnerId: number, loserId: number) {
    // Create a position map for O(1) lookups
    const positionMap = new Map<number, number>();
    list.forEach((id, index) => positionMap.set(id, index));

    const winnerIndex = positionMap.get(winnerId);
    const loserIndex = positionMap.get(loserId);

    // Winner already beats loser, no change needed
    if (winnerIndex !== undefined && loserIndex !== undefined && winnerIndex < loserIndex) {
        return [...list];
    }

    const nextList = [...list];

    if (winnerIndex !== undefined && loserIndex !== undefined && winnerIndex > loserIndex) {
        // Winner is currently below loser, move winner above loser
        nextList.splice(winnerIndex, 1);
        const newLoserIndex = nextList.indexOf(loserId);
        nextList.splice(newLoserIndex, 0, winnerId);
    } else if (winnerIndex === undefined && loserIndex !== undefined) {
        // Winner is new, insert above loser
        nextList.splice(loserIndex, 0, winnerId);
    } else if (winnerIndex !== undefined && loserIndex === undefined) {
        // Loser is new, append to end
        nextList.push(loserId);
    } else if (winnerIndex === undefined && loserIndex === undefined) {
        // Both are new, append both
        nextList.push(winnerId, loserId);
    }

    return [...new Set(nextList)]; // Remove duplicates if any
}

export function buildMovieFaceoffReplayState(
    events: MovieFaceoffEvent[],
    movies: MovieFaceoffMovie[]
): MovieFaceoffReplayState {
    const movieMap = new Map(movies.map((movie) => [movie.id, movie] as const));
    const ratings = new Map<number, MovieFaceoffRankedMovie>();
    const beatMap: BeatMap = new Map();
    const decisiveMovieIds = new Set<number>();
    let manualList: number[] = [];

    const sortedEvents = [...events]
        .filter((event) => event.type === 'vote')
        .sort(
            (a, b) =>
                (a.id ?? Number.MAX_SAFE_INTEGER) -
                    (b.id ?? Number.MAX_SAFE_INTEGER) ||
                a.createdAt.localeCompare(b.createdAt)
        );

    for (const event of sortedEvents) {
        const winnerId = event.winnerId;
        const loserId = event.loserId;

        decisiveMovieIds.add(winnerId);
        decisiveMovieIds.add(loserId);

        const winner = { ...syncRankedMovieMetadata(winnerId, movieMap, ratings) };
        const loser = { ...syncRankedMovieMetadata(loserId, movieMap, ratings) };

        const expectedWinner =
            1 / (1 + 10 ** ((loser.rating - winner.rating) / 400));
        const expectedLoser = 1 - expectedWinner;

        winner.rating += 32 * (1 - expectedWinner);
        loser.rating += 32 * (0 - expectedLoser);
        winner.winCount++;
        loser.lossCount++;

        // Update Glicko ratings
        updateGlickoRatings(winner, loser);

        ratings.set(winnerId, winner);
        ratings.set(loserId, loser);

        if (!beatMap.has(winnerId)) {
            beatMap.set(winnerId, new Set());
        }
        beatMap.get(winnerId)?.add(loserId);
        manualList = insertManualRank(manualList, winnerId, loserId);
    }

    for (const [movieId] of ratings) {
        syncRankedMovieMetadata(movieId, movieMap, ratings);
    }

    return {
        events: sortedEvents,
        movies: [...movies],
        beatMap,
        decisiveMovieIds,
        manualList,
        movieMap,
        ratings,
    };
}
