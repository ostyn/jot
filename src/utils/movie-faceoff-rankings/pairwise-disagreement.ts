import { MovieFaceoffRankedMovie } from '../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm, MovieFaceoffReplayState } from './types';

/**
 * Pairwise judgment data across the primary ranking algorithms. The matrix
 * `d` is flat row-major (`d[i * n + j]` = number of primary algorithms that
 * rank `ids[i]` above `ids[j]`). The number of algorithms that ranked BOTH
 * `i` and `j` equals `d[i*n+j] + d[j*n+i]` — kept implicit, no second matrix.
 *
 * Both `consensus-schulze` and the disagreement-driven pairing engine consume
 * this. One build per replay state, two readers.
 */
export type PairwiseDisagreement = {
    ids: number[];
    idIndex: Map<number, number>;
    n: number;
    d: Int32Array;
    movieById: Map<number, MovieFaceoffRankedMovie>;
};

function selectPrimaryAlgorithms(
    algorithms: readonly MovieFaceoffRankingAlgorithm[]
): MovieFaceoffRankingAlgorithm[] {
    return algorithms.filter((a) => !a.isAggregate && !a.isInformational);
}

export function buildPairwiseDisagreement(
    replay: MovieFaceoffReplayState,
    algorithms: readonly MovieFaceoffRankingAlgorithm[]
): PairwiseDisagreement {
    const primaries = selectPrimaryAlgorithms(algorithms);

    const movieById = new Map<number, MovieFaceoffRankedMovie>();
    const ranksPerAlgorithm: Map<number, number>[] = [];
    const allIds = new Set<number>();

    for (const algorithm of primaries) {
        const ranked = algorithm.rank(replay);
        const rankMap = new Map<number, number>();
        ranked.forEach((movie, index) => {
            rankMap.set(movie.id, index);
            allIds.add(movie.id);
            if (!movieById.has(movie.id)) movieById.set(movie.id, movie);
        });
        ranksPerAlgorithm.push(rankMap);
    }

    const ids = Array.from(allIds);
    const n = ids.length;
    const idIndex = new Map<number, number>();
    for (let i = 0; i < n; i++) idIndex.set(ids[i], i);

    const d = new Int32Array(n * n);
    if (n) {
        for (const rankMap of ranksPerAlgorithm) {
            for (let i = 0; i < n; i++) {
                const rankI = rankMap.get(ids[i]);
                if (rankI === undefined) continue;
                const rowI = i * n;
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const rankJ = rankMap.get(ids[j]);
                    if (rankJ === undefined) continue;
                    if (rankI < rankJ) d[rowI + j]++;
                }
            }
        }
    }

    return { ids, idIndex, n, d, movieById };
}

const cache = new WeakMap<
    MovieFaceoffReplayState,
    Map<readonly MovieFaceoffRankingAlgorithm[], PairwiseDisagreement>
>();

/**
 * Memoized variant. Keyed on (replay reference, algorithms reference). The
 * top-level algorithms array is a stable module-level constant in practice,
 * so this gives a hit on the second+ call within the same replay state —
 * which is exactly the display + preload pattern the route exercises.
 */
export function getPairwiseDisagreement(
    replay: MovieFaceoffReplayState,
    algorithms: readonly MovieFaceoffRankingAlgorithm[]
): PairwiseDisagreement {
    let inner = cache.get(replay);
    if (!inner) {
        inner = new Map();
        cache.set(replay, inner);
    }
    const cached = inner.get(algorithms);
    if (cached) return cached;
    const result = buildPairwiseDisagreement(replay, algorithms);
    inner.set(algorithms, result);
    return result;
}

/**
 * Disagreement score for the pair (i, j) at matrix indices, in [0, 1].
 * Peaks when the algorithms split 50/50 on the pair, drops to 0 when they
 * agree (or when only one algorithm has an opinion — saturation dampens
 * pairs with thin coverage so a 1-of-7 split doesn't dominate the signal).
 */
export function pairDisagreement(
    matrix: PairwiseDisagreement,
    i: number,
    j: number
): number {
    const { d, n } = matrix;
    if (i < 0 || j < 0 || i >= n || j >= n || i === j) return 0;
    const above = d[i * n + j];
    const below = d[j * n + i];
    const k = above + below;
    if (k === 0) return 0;
    const split = 1 - Math.abs(above - below) / k;
    return split * (k / (k + 2));
}

export type AgreementSummary = {
    /** Mean cross-algorithm agreement over covered pairs, in [0, 1]. */
    agreement: number;
    /** Number of unordered pairs with ≥1 algorithm covering both. */
    coveredPairs: number;
};

/**
 * Summarize the matrix into a single agreement indicator. The K primary
 * algorithms each extrapolate from observed votes to a full ranking; their
 * pairwise agreement is the quality of that extrapolation.
 *
 * Uses the unsaturated split per pair: a unanimous pair reads 100%, a
 * perfect 50/50 split reads 0%. The chip should hide itself until there
 * are enough covered pairs for the number to mean something — this
 * function intentionally does no dampening of its own.
 */
export function summarizeAgreement(matrix: PairwiseDisagreement): AgreementSummary {
    const { n, d } = matrix;
    if (n < 2) return { agreement: 0, coveredPairs: 0 };

    let coveredPairs = 0;
    let agreementSum = 0;
    for (let i = 0; i < n; i++) {
        const rowI = i * n;
        for (let j = i + 1; j < n; j++) {
            const above = d[rowI + j];
            const below = d[j * n + i];
            const k = above + below;
            if (k === 0) continue;
            coveredPairs++;
            agreementSum += Math.abs(above - below) / k;
        }
    }

    if (coveredPairs === 0) return { agreement: 0, coveredPairs: 0 };
    return { agreement: agreementSum / coveredPairs, coveredPairs };
}
