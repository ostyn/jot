import { MovieFaceoffRankedMovie } from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';

export function getCandidatePool(
    allIds: number[],
    excludedIds: Set<number>,
    unseenIds: Set<number>,
    exclude: number[] = []
): number[] {
    return allIds.filter(
        (id) =>
            !excludedIds.has(id) &&
            !unseenIds.has(id) &&
            !exclude.includes(id)
    );
}

type LoadMovie = (id: number) => Promise<FaceoffMovie>;

function computeSmartWeights(
    pool: number[],
    ratings: Map<number, MovieFaceoffRankedMovie>,
    firstMovieId?: number
) {
    const firstRating =
        firstMovieId !== undefined ? ratings.get(firstMovieId) : undefined;
    const firstTotalVotes = firstRating
        ? (firstRating.winCount || 0) + (firstRating.lossCount || 0)
        : 0;
    const firstRatingValue = firstRating?.rating || 1500;

    const weights: number[] = [];
    let totalWeight = 0;
    for (const id of pool) {
        const rating = ratings.get(id);
        const totalVotes = (rating?.winCount || 0) + (rating?.lossCount || 0);

        let weight = Math.max(1, 100 - totalVotes * 2);
        const ratingDeviation = rating?.ratingDeviation || 350;
        if (ratingDeviation > 200) weight *= 1.5;

        if (firstMovieId !== undefined) {
            const voteDiff = Math.abs(totalVotes - firstTotalVotes);
            if (voteDiff > 10) weight *= 1.3;
            const candidateRatingValue = rating?.rating || 1500;
            const ratingDiff = Math.abs(firstRatingValue - candidateRatingValue);
            if (ratingDiff < 300) weight *= 1.2;
        }

        weights.push(weight);
        totalWeight += weight;
    }
    return { weights, totalWeight };
}

function pickWeightedIndex(weights: number[], totalWeight: number): number {
    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) return i;
    }
    return weights.length - 1;
}

export function pickSmartMovieId(
    pool: number[],
    ratings: Map<number, MovieFaceoffRankedMovie>,
    firstMovieId?: number
): number | null {
    if (!pool.length) return null;
    const { weights, totalWeight } = computeSmartWeights(pool, ratings, firstMovieId);
    return pool[pickWeightedIndex(weights, totalWeight)];
}

export function pickRandomMovieId(pool: number[]): number | null {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Fast weighted random selection for intelligent movie pairing.
 * Prioritizes under-voted movies while maintaining O(n) complexity.
 */
export async function getSmartMovie(
    pool: number[],
    ratings: Map<number, MovieFaceoffRankedMovie>,
    loadMovie: LoadMovie,
    firstMovie?: FaceoffMovie
): Promise<FaceoffMovie | null> {
    if (!pool.length) return null;

    const { weights, totalWeight } = computeSmartWeights(pool, ratings, firstMovie?.id);
    const pickedIndex = pickWeightedIndex(weights, totalWeight);
    try {
        return await loadMovie(pool[pickedIndex]);
    } catch (_error) {
        const newPool = pool.filter((_, idx) => idx !== pickedIndex);
        return getWeightedRandomMovie(
            newPool,
            weights.filter((_, idx) => idx !== pickedIndex),
            loadMovie
        );
    }
}

async function getWeightedRandomMovie(
    pool: number[],
    weights: number[],
    loadMovie: LoadMovie
): Promise<FaceoffMovie | null> {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            try {
                return await loadMovie(pool[i]);
            } catch (_error) {
                continue;
            }
        }
    }

    return null;
}

export async function getRandomMovie(
    pool: number[],
    loadMovie: LoadMovie
): Promise<FaceoffMovie | null> {
    const candidateIds = [...pool];
    while (candidateIds.length) {
        const index = Math.floor(Math.random() * candidateIds.length);
        const [id] = candidateIds.splice(index, 1);
        try {
            return await loadMovie(id);
        } catch (_error) {
            continue;
        }
    }

    return null;
}
