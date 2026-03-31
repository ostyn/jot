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
            winCount: 0,
            lossCount: 0,
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

function insertManualRank(list: number[], winnerId: number, loserId: number) {
    const nextList = [...list];
    const winnerIndex = nextList.indexOf(winnerId);
    const loserIndex = nextList.indexOf(loserId);

    if (winnerIndex !== -1 && loserIndex !== -1 && winnerIndex < loserIndex) {
        return [...new Set(nextList)];
    }

    if (winnerIndex !== -1 && loserIndex !== -1 && winnerIndex > loserIndex) {
        nextList.splice(winnerIndex, 1);
        const newLoserIndex = nextList.indexOf(loserId);
        nextList.splice(newLoserIndex, 0, winnerId);
    }

    if (winnerIndex === -1 && loserIndex !== -1) {
        nextList.splice(nextList.indexOf(loserId), 0, winnerId);
    }

    if (winnerIndex !== -1 && loserIndex === -1) {
        nextList.push(loserId);
    }

    if (winnerIndex === -1 && loserIndex === -1) {
        nextList.push(winnerId, loserId);
    }

    return [...new Set(nextList)];
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
