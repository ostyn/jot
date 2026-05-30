import { MovieFaceoffSortMode } from '../../interfaces/movie-faceoff.interface';
import {
    buildPairwiseDisagreement,
    summarizeAgreement,
} from './pairwise-disagreement';
import { MovieFaceoffRankingAlgorithm, MovieFaceoffReplayState } from './types';

/**
 * Per-algorithm leave-one-out impact on the primary pool's mutual agreement.
 *
 * `delta = agreementWithout - baseline`:
 *  - delta > 0  removing the algorithm RAISES agreement → it's a *dissenter*
 *               pulling the consensus apart (the one to scrutinize/demote).
 *  - delta < 0  removing it LOWERS agreement → it's an *echo* reinforcing the
 *               pack; its high agreement was partly redundancy (the surprise
 *               we saw when Copeland left and the number dropped 79%→77%).
 *  - delta ≈ 0  neutral — neither props the consensus up nor pulls it apart.
 */
export type AgreementContribution = {
    id: MovieFaceoffSortMode;
    label: string;
    /** Mean agreement of the OTHER primaries with this one excluded. */
    agreementWithout: number;
    /** Covered pairs in the leave-one-out matrix (coverage can shrink). */
    coveredPairsWithout: number;
    /** agreementWithout - baselineAgreement. See type docs for sign meaning. */
    delta: number;
};

export type AgreementLeaveOneOut = {
    /** Mutual agreement across all primaries, in [0, 1]. */
    baselineAgreement: number;
    baselineCoveredPairs: number;
    /** Number of primary (non-aggregate, non-informational) algorithms. */
    primaryCount: number;
    /**
     * One entry per primary, sorted by `delta` descending — biggest dissenter
     * first, biggest echo last. Empty when there are fewer than 3 primaries:
     * leaving one out of ≤2 leaves a pool of ≤1, whose agreement is trivially
     * 1.0, so the delta would carry no signal.
     */
    contributions: AgreementContribution[];
};

/**
 * Measures how much each primary ranking algorithm props up — or pulls apart —
 * the consensus, by recomputing `summarizeAgreement` with that algorithm held
 * out. Answers "which algorithm is actually moving the agreement number?" on a
 * concrete replay state, rather than reasoning about failure modes a priori.
 */
export function computeAgreementLeaveOneOut(
    replay: MovieFaceoffReplayState,
    algorithms: readonly MovieFaceoffRankingAlgorithm[]
): AgreementLeaveOneOut {
    const primaries = algorithms.filter(
        (a) => !a.isAggregate && !a.isInformational
    );

    const baseline = summarizeAgreement(
        buildPairwiseDisagreement(replay, primaries)
    );

    const result: AgreementLeaveOneOut = {
        baselineAgreement: baseline.agreement,
        baselineCoveredPairs: baseline.coveredPairs,
        primaryCount: primaries.length,
        contributions: [],
    };

    if (primaries.length < 3) return result;

    result.contributions = primaries
        .map((left) => {
            const remaining = primaries.filter((a) => a.id !== left.id);
            const summary = summarizeAgreement(
                buildPairwiseDisagreement(replay, remaining)
            );
            return {
                id: left.id,
                label: left.label,
                agreementWithout: summary.agreement,
                coveredPairsWithout: summary.coveredPairs,
                delta: summary.agreement - baseline.agreement,
            };
        })
        .sort((a, b) => b.delta - a.delta);

    return result;
}
