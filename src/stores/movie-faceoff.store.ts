import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import {
    MovieFaceoffEvent,
    MovieFaceoffExportData,
    MovieFaceoffMovie,
} from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import { movieFaceoffDao } from '../dao/MovieFaceoffDao';
import { buildMovieFaceoffReplayState, MovieFaceoffReplayState } from '../utils/movie-faceoff-rankings';

function upsertById<T extends { id: number }>(items: T[], nextItem: T): T[] {
    const index = items.findIndex((item) => item.id === nextItem.id);
    if (index === -1) return [...items, nextItem];
    const nextItems = [...items];
    nextItems[index] = nextItem;
    return nextItems;
}

function toStoredMovie(
    movie: FaceoffMovie,
    existing?: MovieFaceoffMovie
): MovieFaceoffMovie {
    const now = new Date().toISOString();
    return {
        id: movie.id,
        title: movie.title,
        posterPath: movie.poster_path || existing?.posterPath,
        releaseDate: movie.release_date || existing?.releaseDate,
        excludedAt: existing?.excludedAt,
        unseenAt: existing?.unseenAt,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };
}

class MovieFaceoffStore {
    @observable
    allEvents: MovieFaceoffEvent[] = [];

    @observable
    allMovies: MovieFaceoffMovie[] = [];

    private loadPromise?: Promise<void>;

    constructor() {
        makeObservable(this);
    }

    @action.bound
    ensureLoaded() {
        if (!this.loadPromise) this.loadPromise = this.refresh();
        return this.loadPromise;
    }

    @computed
    get replayState(): MovieFaceoffReplayState {
        return buildMovieFaceoffReplayState(this.allEvents, this.allMovies);
    }

    @computed
    get movieMap() {
        return new Map(this.allMovies.map((movie) => [movie.id, movie] as const));
    }

    @computed
    get excludedMovieIds() {
        return new Set(
            this.allMovies
                .filter((movie) => Boolean(movie.excludedAt))
                .map((movie) => movie.id)
        );
    }

    @computed
    get unseenMovieIds() {
        return new Set(
            this.allMovies
                .filter((movie) => Boolean(movie.unseenAt))
                .map((movie) => movie.id)
        );
    }

    @action.bound
    async refresh() {
        const [events, movies] = await Promise.all([
            movieFaceoffDao.getEvents(),
            movieFaceoffDao.getMovies(),
        ]);
        runInAction(() => {
            this.allEvents = events;
            this.allMovies = movies;
        });
    }

    @action.bound
    async upsertMoviesMetadata(movies: FaceoffMovie[]) {
        const uniqueMovies = new Map<number, FaceoffMovie>();
        movies.forEach((movie) => uniqueMovies.set(movie.id, movie));
        if (!uniqueMovies.size) return;

        const nextMovies = Array.from(uniqueMovies.values()).map((movie) =>
            toStoredMovie(movie, this.movieMap.get(movie.id))
        );

        await movieFaceoffDao.bulkPutMovies(nextMovies);
        runInAction(() => {
            let updatedMovies = [...this.allMovies];
            nextMovies.forEach((movie) => {
                updatedMovies = upsertById(updatedMovies, movie);
            });
            this.allMovies = updatedMovies;
        });
    }

    @action.bound
    async recordVote(
        winnerMovie: FaceoffMovie,
        loserMovie: FaceoffMovie,
        targetId?: number
    ) {
        await this.upsertMoviesMetadata([winnerMovie, loserMovie]);
        const event: Omit<MovieFaceoffEvent, 'id'> = {
            createdAt: new Date().toISOString(),
            type: 'vote',
            winnerId: winnerMovie.id,
            loserId: loserMovie.id,
            ...(targetId !== undefined ? { targetId } : {}),
        };
        const id = await movieFaceoffDao.addEvent(event);
        runInAction(() => {
            this.allEvents = [...this.allEvents, { ...event, id }];
        });
        return id;
    }

    @action.bound
    async deleteEvent(id: number) {
        await movieFaceoffDao.deleteEvent(id);
        runInAction(() => {
            this.allEvents = this.allEvents.filter((event) => event.id !== id);
        });
    }

    @action.bound
    async setMovieExcludedAt(id: number, excludedAt?: string) {
        const existingMovie = this.movieMap.get(id);
        if (!existingMovie) return;
        const updatedMovie: MovieFaceoffMovie = {
            ...existingMovie,
            excludedAt,
            updatedAt: new Date().toISOString(),
        };
        await movieFaceoffDao.saveMovie(updatedMovie);
        runInAction(() => {
            this.allMovies = upsertById(this.allMovies, updatedMovie);
        });
    }

    @action.bound
    async setMovieUnseenAt(id: number, unseenAt?: string) {
        const existingMovie = this.movieMap.get(id);
        if (!existingMovie) return;
        const updatedMovie: MovieFaceoffMovie = {
            ...existingMovie,
            unseenAt,
            updatedAt: new Date().toISOString(),
        };
        await movieFaceoffDao.saveMovie(updatedMovie);
        runInAction(() => {
            this.allMovies = upsertById(this.allMovies, updatedMovie);
        });
    }

    @action.bound
    async excludeMovie(id: number) {
        await this.setMovieExcludedAt(id, new Date().toISOString());
    }

    @action.bound
    async restoreMovie(id: number) {
        await this.setMovieExcludedAt(id, undefined);
    }

    @action.bound
    async markMovieUnseen(id: number) {
        await this.setMovieUnseenAt(id, new Date().toISOString());
    }

    @action.bound
    async markMoviesUnseen(ids: number[]) {
        for (const id of [...new Set(ids)]) {
            await this.markMovieUnseen(id);
        }
    }

    @action.bound
    async restoreMovieSeen(id: number) {
        await this.setMovieUnseenAt(id, undefined);
    }

    @action.bound
    async reset() {
        await movieFaceoffDao.reset();
        runInAction(() => {
            this.allEvents = [];
            this.allMovies = [];
        });
    }

    @action.bound
    async importData(
        data: MovieFaceoffExportData | undefined,
        options: { overwrite: boolean }
    ) {
        if (options.overwrite) {
            await movieFaceoffDao.reset();
        }
        if (data) {
            await movieFaceoffDao.bulkPutMovies(data.movies);
            await movieFaceoffDao.bulkPutEvents(data.events);
        }
        await this.refresh();
    }
}

export const movieFaceoff = new MovieFaceoffStore();
