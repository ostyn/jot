import { db } from '../services/Dexie';
import {
    MovieFaceoffEvent,
    MovieFaceoffMovie,
} from '../interfaces/movie-faceoff.interface';

export class MovieFaceoffDao {
    private readonly eventsTableName = 'movieFaceoffEvents';
    private readonly moviesTableName = 'movieFaceoffMovies';

    async getEvents(): Promise<MovieFaceoffEvent[]> {
        return (await db
            .table(this.eventsTableName)
            .orderBy('id')
            .toArray()) as MovieFaceoffEvent[];
    }

    async getMovies(): Promise<MovieFaceoffMovie[]> {
        return (await db.table(this.moviesTableName).toArray()) as MovieFaceoffMovie[];
    }

    async addEvent(event: Omit<MovieFaceoffEvent, 'id'>): Promise<number> {
        return Number(await db.table(this.eventsTableName).add(event));
    }

    async deleteEvent(id: number): Promise<void> {
        await db.table(this.eventsTableName).delete(id);
    }

    async bulkPutEvents(events: MovieFaceoffEvent[]): Promise<void> {
        if (!events.length) return;
        await db.table(this.eventsTableName).bulkPut(events);
    }

    async saveMovie(movie: MovieFaceoffMovie): Promise<number> {
        await db.table(this.moviesTableName).put(movie);
        return movie.id;
    }

    async bulkPutMovies(movies: MovieFaceoffMovie[]): Promise<void> {
        if (!movies.length) return;
        await db.table(this.moviesTableName).bulkPut(movies);
    }

    async reset(): Promise<void> {
        await db.table(this.eventsTableName).clear();
        await db.table(this.moviesTableName).clear();
    }
}

export const movieFaceoffDao = new MovieFaceoffDao();
