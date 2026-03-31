import {
    MovieFaceoffEvent,
    MovieFaceoffMovie,
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../../interfaces/movie-faceoff.interface';

export type BeatMap = Map<number, Set<number>>;

export type MovieFaceoffReplayState = {
    events: MovieFaceoffEvent[];
    movies: MovieFaceoffMovie[];
    beatMap: BeatMap;
    decisiveMovieIds: Set<number>;
    manualList: number[];
    movieMap: Map<number, MovieFaceoffMovie>;
    ratings: Map<number, MovieFaceoffRankedMovie>;
};

export interface MovieFaceoffRankingAlgorithm {
    id: MovieFaceoffSortMode;
    label: string;
    description: string;
    rank: (replay: MovieFaceoffReplayState) => MovieFaceoffRankedMovie[];
    formatMetric: (movie: MovieFaceoffRankedMovie) => string;
}
