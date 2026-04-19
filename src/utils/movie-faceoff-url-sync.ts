import {
    MOVIE_FACEOFF_SORT_MODES,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';

export interface MovieFaceoffUrlState {
    targetMovieId?: number;
    sortMode?: MovieFaceoffSortMode;
    pairIds?: [number, number];
    useRankedOnly: boolean;
}

const isPositiveFiniteNumber = (value: number) =>
    Number.isFinite(value) && value > 0;

export function parseMovieFaceoffUrl(search: string): MovieFaceoffUrlState {
    const params = new URLSearchParams(search);

    const rawTarget = Number(params.get('targetMovieId'));
    const targetMovieId = isPositiveFiniteNumber(rawTarget) ? rawTarget : undefined;

    const sortParam = params.get('sort');
    const sortMode =
        sortParam &&
        (MOVIE_FACEOFF_SORT_MODES as readonly string[]).includes(sortParam)
            ? (sortParam as MovieFaceoffSortMode)
            : undefined;

    const leftId = Number(params.get('left'));
    const rightId = Number(params.get('right'));
    const pairIds: [number, number] | undefined =
        isPositiveFiniteNumber(leftId) && isPositiveFiniteNumber(rightId)
            ? [leftId, rightId]
            : undefined;

    const useRankedOnly = params.get('pool') === 'mine';

    return { targetMovieId, sortMode, pairIds, useRankedOnly };
}

export function updateMovieFaceoffQueryParams(
    params: Record<string, string | number | undefined>
) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) url.searchParams.delete(key);
        else url.searchParams.set(key, String(value));
    }
    history.replaceState(null, '', url);
}
