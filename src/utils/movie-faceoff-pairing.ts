import { MovieFaceoffRankedMovie } from '../interfaces/movie-faceoff.interface';
import {
    getPairwiseDisagreement,
    pairDisagreement,
} from './movie-faceoff-rankings/pairwise-disagreement';
import {
    MovieFaceoffRankingAlgorithm,
    MovieFaceoffReplayState,
} from './movie-faceoff-rankings/types';

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

// Disagreement-driven pair selection.
//
// Each pair gets `weight(i, j) = α * disagreement(i, j) + coldStart(i) + coldStart(j)`.
// Disagreement comes from the cross-algorithm `d[i][j]` matrix (how many primary
// ranking algorithms put i above j) — high when the algorithms split, near 0
// when they agree. Cold-start (under-vote count + Glicko RD) keeps fresh
// movies sampleable when the matrix has nothing to say. The terms are
// **additive** so cold-start can carry the signal even when disagreement is 0
// for every pair (fresh user, no votes).
const DISAGREEMENT_GAIN = 50;

function coldStartWeight(rating: MovieFaceoffRankedMovie | undefined): number {
    const totalVotes = (rating?.winCount || 0) + (rating?.lossCount || 0);
    let weight = Math.max(1, 100 - totalVotes * 2);
    const ratingDeviation = rating?.ratingDeviation || 350;
    if (ratingDeviation > 200) weight *= 1.5;
    return weight;
}

function pickWeighted(weights: Float64Array, total: number, count: number): number {
    if (total <= 0) return -1;
    let r = Math.random() * total;
    let lastPositive = -1;
    for (let i = 0; i < count; i++) {
        if (weights[i] <= 0) continue;
        lastPositive = i;
        r -= weights[i];
        if (r <= 0) return i;
    }
    return lastPositive;
}

/**
 * Pick a pair (left, right) from `leftPool × rightPool` weighted by
 * disagreement plus cold-start. Returns `[leftId, rightId]` or `null` when
 * no valid pair exists. Same pool reference for both args = single-mode
 * pairing; different pools = cross-mode.
 */
export function pickInformativePair(
    leftPool: number[],
    rightPool: number[],
    replay: MovieFaceoffReplayState,
    algorithms: readonly MovieFaceoffRankingAlgorithm[]
): [number, number] | null {
    if (!leftPool.length || !rightPool.length) return null;
    if (leftPool.length === 1 && rightPool.length === 1 && leftPool[0] === rightPool[0]) {
        return null;
    }

    const matrix = getPairwiseDisagreement(replay, algorithms);
    const ratings = replay.ratings;

    const leftCold = leftPool.map((id) => coldStartWeight(ratings.get(id)));
    const rightCold = rightPool.map((id) => coldStartWeight(ratings.get(id)));
    const leftMatIdx = leftPool.map((id) => matrix.idIndex.get(id) ?? -1);
    const rightMatIdx = rightPool.map((id) => matrix.idIndex.get(id) ?? -1);

    const rowTotals = new Float64Array(leftPool.length);
    let grandTotal = 0;
    for (let i = 0; i < leftPool.length; i++) {
        let sum = 0;
        for (let j = 0; j < rightPool.length; j++) {
            if (leftPool[i] === rightPool[j]) continue;
            const dis = pairDisagreement(matrix, leftMatIdx[i], rightMatIdx[j]);
            sum += DISAGREEMENT_GAIN * dis + leftCold[i] + rightCold[j];
        }
        rowTotals[i] = sum;
        grandTotal += sum;
    }

    if (grandTotal <= 0) return null;

    const pickedI = pickWeighted(rowTotals, grandTotal, leftPool.length);
    if (pickedI < 0) return null;

    const rowWeights = new Float64Array(rightPool.length);
    let rowSum = 0;
    for (let j = 0; j < rightPool.length; j++) {
        if (leftPool[pickedI] === rightPool[j]) {
            rowWeights[j] = 0;
            continue;
        }
        const dis = pairDisagreement(matrix, leftMatIdx[pickedI], rightMatIdx[j]);
        rowWeights[j] = DISAGREEMENT_GAIN * dis + leftCold[pickedI] + rightCold[j];
        rowSum += rowWeights[j];
    }

    const pickedJ = pickWeighted(rowWeights, rowSum, rightPool.length);
    if (pickedJ < 0) return null;
    return [leftPool[pickedI], rightPool[pickedJ]];
}

/**
 * Pick a single opponent for a pinned movie. Same scoring as the joint
 * pair sampler, but the first id is fixed.
 */
export function pickInformativeOpponent(
    pool: number[],
    replay: MovieFaceoffReplayState,
    algorithms: readonly MovieFaceoffRankingAlgorithm[],
    firstMovieId: number
): number | null {
    const candidates = pool.filter((id) => id !== firstMovieId);
    if (!candidates.length) return null;

    const matrix = getPairwiseDisagreement(replay, algorithms);
    const ratings = replay.ratings;
    const firstCold = coldStartWeight(ratings.get(firstMovieId));
    const firstMatIdx = matrix.idIndex.get(firstMovieId) ?? -1;

    const weights = new Float64Array(candidates.length);
    let total = 0;
    for (let j = 0; j < candidates.length; j++) {
        const matJ = matrix.idIndex.get(candidates[j]) ?? -1;
        const dis = pairDisagreement(matrix, firstMatIdx, matJ);
        const cs = firstCold + coldStartWeight(ratings.get(candidates[j]));
        weights[j] = DISAGREEMENT_GAIN * dis + cs;
        total += weights[j];
    }

    const picked = pickWeighted(weights, total, candidates.length);
    if (picked < 0) return null;
    return candidates[picked];
}
