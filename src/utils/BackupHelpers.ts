import { parseISO } from 'date-fns';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { Note } from '../interfaces/note.interface';
import { ReadingItem } from '../interfaces/reading-item.interface';
import { MovieFaceoffExportData } from '../interfaces/movie-faceoff.interface';
import { db, versions } from '../services/Dexie';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import { moods } from '../stores/moods.store';
import { notes } from '../stores/notes.store';
import { reading } from '../stores/reading.store';
import { inferTargetIds } from './movie-faceoff-backfill';

export interface JsonExport {
    entries: Entry[];
    activities: Activity[];
    moods: Mood[];
    readingItems?: ReadingItem[];
    movieFaceoff?: MovieFaceoffExportData;
    notes?: Note[];
    version: number;
}
export const createExportContents = (beautify = false) => {
    const fileContents: JsonExport = {
        entries: entries.all,
        activities: activities.all,
        moods: moods.userCreated,
        readingItems: reading.all,
        movieFaceoff: {
            events: movieFaceoff.allEvents,
            movies: movieFaceoff.allMovies,
        },
        notes: notes.all,
        version: db.verno,
    };
    return JSON.stringify(fileContents, undefined, beautify ? 2 : 0);
};
export function prepJsonForImport({
    entries,
    moods,
    activities,
    readingItems,
    movieFaceoff,
    notes,
    version,
}: JsonExport) {
    const importVersion = version ?? 3;
    entries.forEach((entry: Entry) => {
        versions[importVersion].importTransform(entry);
    });
    notes?.forEach((note: Note) => {
        versions[4].importTransform(note as unknown as Entry);
    });
    for (let v = importVersion + 1; v <= db.verno; v++) {
        if (versions[v]) {
            entries.forEach((entry: Entry) => {
                versions[v].upgrade(entry);
            });
        }
    }

    moods.forEach((mood: Mood) => {
        mood.created = parseISO(mood.created as unknown as string);
        mood.updated = parseISO(mood.updated as unknown as string);
    });
    activities.forEach((activity: Activity) => {
        activity.created = parseISO(activity.created as unknown as string);
        activity.updated = parseISO(activity.updated as unknown as string);
    });

    movieFaceoff?.movies.forEach((movie) => {
        movie.excludedAt = movie.excludedAt || undefined;
        movie.unseenAt = movie.unseenAt || undefined;
    });

    const legacyUnseenAtById = new Map<number, string>();
    const nextMovieFaceoffEvents: MovieFaceoffExportData['events'] = [];

    const markLegacyUnseen = (movieId: number, createdAt: string) => {
        const previousDate = legacyUnseenAtById.get(movieId);
        if (!previousDate || previousDate > createdAt) {
            legacyUnseenAtById.set(movieId, createdAt);
        }
    };

    movieFaceoff?.events.forEach((event) => {
        const legacyEvent = event as typeof event & {
            leftMovieId?: number;
            rightMovieId?: number;
            outcome?: string;
            winnerId?: number;
            loserId?: number;
            type?: string;
        };

        if (
            legacyEvent.type === 'vote' &&
            typeof legacyEvent.winnerId === 'number' &&
            typeof legacyEvent.loserId === 'number'
        ) {
            nextMovieFaceoffEvents.push({
                id: legacyEvent.id,
                createdAt: legacyEvent.createdAt,
                type: 'vote',
                winnerId: legacyEvent.winnerId,
                loserId: legacyEvent.loserId,
                ...(typeof event.targetId === 'number'
                    ? { targetId: event.targetId }
                    : {}),
            });
            return;
        }

        if (
            typeof legacyEvent.leftMovieId !== 'number' ||
            typeof legacyEvent.rightMovieId !== 'number'
        ) {
            return;
        }

        if (
            legacyEvent.outcome === 'left_won' ||
            legacyEvent.outcome === 'right_won'
        ) {
            nextMovieFaceoffEvents.push({
                id: legacyEvent.id,
                createdAt: legacyEvent.createdAt,
                type: 'vote',
                winnerId:
                    legacyEvent.outcome === 'left_won'
                        ? legacyEvent.leftMovieId
                        : legacyEvent.rightMovieId,
                loserId:
                    legacyEvent.outcome === 'left_won'
                        ? legacyEvent.rightMovieId
                        : legacyEvent.leftMovieId,
            });
            return;
        }

        if (legacyEvent.outcome === 'left_skipped') {
            markLegacyUnseen(legacyEvent.leftMovieId, legacyEvent.createdAt);
        } else if (legacyEvent.outcome === 'right_skipped') {
            markLegacyUnseen(legacyEvent.rightMovieId, legacyEvent.createdAt);
        } else if (legacyEvent.outcome === 'both_skipped') {
            markLegacyUnseen(legacyEvent.leftMovieId, legacyEvent.createdAt);
            markLegacyUnseen(legacyEvent.rightMovieId, legacyEvent.createdAt);
        }
    });

    if (movieFaceoff) {
        const needsBackfill = nextMovieFaceoffEvents.some(
            (event) => event.targetId === undefined
        );
        if (needsBackfill) {
            const inferred = inferTargetIds(nextMovieFaceoffEvents);
            for (const event of nextMovieFaceoffEvents) {
                if (event.id !== undefined && event.targetId === undefined && inferred.has(event.id)) {
                    event.targetId = inferred.get(event.id);
                }
            }
        }
        movieFaceoff.events = nextMovieFaceoffEvents;
        movieFaceoff.movies = movieFaceoff.movies.map((movie) => ({
            ...movie,
            unseenAt: movie.unseenAt || legacyUnseenAtById.get(movie.id),
        }));
    }

    readingItems?.forEach((item) => {
        item.metadataUpdatedAt = item.metadataUpdatedAt || undefined;
        item.openedAt = item.openedAt || undefined;
        item.completedAt = item.completedAt || undefined;
    });
}
