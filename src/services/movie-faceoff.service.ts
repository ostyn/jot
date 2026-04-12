const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;

export type FaceoffMovie = {
    id: number;
    title: string;
    poster_path?: string | null;
    release_date?: string;
};

export function getMovieFaceoffAssetUrl() {
    return '/generated/filtered_movie_ids.json';
}

export async function fetchMovieFaceoffIds(): Promise<number[]> {
    const response = await fetch(getMovieFaceoffAssetUrl());
    if (!response.ok) {
        throw new Error(`Unable to load movie ids (${response.status})`);
    }
    return (await response.json()) as number[];
}

export async function fetchTmdbMovie(id: number): Promise<FaceoffMovie> {
    if (!tmdbApiKey) {
        throw new Error('Missing TMDB API key');
    }

    const response = await fetch(
        `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`
    );

    if (!response.ok) {
        throw new Error(`Unable to load movie ${id} (${response.status})`);
    }

    return (await response.json()) as FaceoffMovie;
}

export async function searchTmdbMovies(query: string): Promise<FaceoffMovie[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];
    if (!tmdbApiKey) {
        throw new Error('Missing TMDB API key');
    }

    const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(
            trimmedQuery
        )}`
    );

    if (!response.ok) {
        throw new Error(`Unable to search movies (${response.status})`);
    }

    const data = (await response.json()) as {
        results?: FaceoffMovie[];
    };

    return (data.results || []).filter(
        (movie) => typeof movie.id === 'number' && Boolean(movie.title)
    );
}

export function getMoviePosterUrl(movie: Pick<FaceoffMovie, 'poster_path'>) {
    return movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : '';
}
