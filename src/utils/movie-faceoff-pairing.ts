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

    // O(n) weighted random selection - much faster than sorting
    let totalWeight = 0;
    const weights: number[] = [];

    for (const id of pool) {
        const rating = ratings.get(id);
        const totalVotes = (rating?.winCount || 0) + (rating?.lossCount || 0);

        // Simple weight calculation: prioritize low-vote movies
        let weight = Math.max(1, 100 - totalVotes * 2); // 100 for 0 votes, 1 for 50+ votes

        // Bonus for uncertain rankings (Glicko RD)
        const ratingDeviation = rating?.ratingDeviation || 350;
        if (ratingDeviation > 200) weight *= 1.5; // 50% bonus for uncertain movies

        // Pairing bonuses (when selecting second movie)
        if (firstMovie) {
            const firstRating = ratings.get(firstMovie.id);
            const firstTotalVotes = (firstRating?.winCount || 0) + (firstRating?.lossCount || 0);

            // Bonus for vote count diversity
            const voteDiff = Math.abs(totalVotes - firstTotalVotes);
            if (voteDiff > 10) weight *= 1.3; // 30% bonus for different experience levels

            // Small bonus for rating proximity (refine close rankings)
            const firstRatingValue = firstRating?.rating || 1500;
            const candidateRatingValue = rating?.rating || 1500;
            const ratingDiff = Math.abs(firstRatingValue - candidateRatingValue);
            if (ratingDiff < 300) weight *= 1.2; // 20% bonus for close ratings
        }

        weights.push(weight);
        totalWeight += weight;
    }

    // Single-pass weighted random selection
    let random = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            try {
                return await loadMovie(pool[i]);
            } catch (_error) {
                // Remove this candidate and try weighted selection again
                const newPool = pool.filter((_, idx) => idx !== i);
                return getWeightedRandomMovie(
                    newPool,
                    weights.filter((_, idx) => idx !== i),
                    loadMovie
                );
            }
        }
    }

    // Fallback to simple random selection
    return getRandomMovie(pool, loadMovie);
}

export async function getWeightedRandomMovie(
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
