import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes } from '../test/fixtures/movie-faceoff';
import {
    buildRankingSnapshots,
    computeRankRange,
    getChartSnapshots,
    getHeadlineSnapshot,
    getUncertaintySnapshot,
} from './movie-ranking-snapshots';

describe('buildRankingSnapshots', () => {
    it('includes uncertainty but excludes other informational algorithms', () => {
        const replay = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const snapshots = buildRankingSnapshots(1, replay);
        const ids = snapshots.map((s) => s.algorithm.id);
        expect(ids).toContain('uncertainty');
        expect(ids).not.toContain('wins');
        expect(ids).not.toContain('alphabetical');
        expect(ids).not.toContain('release-date');
        expect(ids).not.toContain('most-compared');
    });

    it('computes percentile from rank and total', () => {
        const replay = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
        ]);
        const snapshots = buildRankingSnapshots(1, replay);
        // Movie 1 should be ranked first in Elo after 2 wins
        const elo = snapshots.find((s) => s.algorithm.id === 'elo')!;
        expect(elo.rank).toBe(1);
        expect(elo.total).toBe(3);
        // percentile: (1 - 1) / (3 - 1) = 0
        expect(elo.percentile).toBe(0);
    });

    it('returns null percentile when total is 1', () => {
        const replay = buildReplayFromVotes([[1, 2]]);
        const snapshots = buildRankingSnapshots(1, replay);
        // "manual" respects order; should work regardless
        const elo = snapshots.find((s) => s.algorithm.id === 'elo')!;
        // total is 2, percentile defined
        expect(elo.percentile).not.toBeNull();
    });
});

describe('getChartSnapshots', () => {
    it('filters out uncertainty', () => {
        const replay = buildReplayFromVotes([[1, 2]]);
        const snapshots = buildRankingSnapshots(1, replay);
        const chart = getChartSnapshots(snapshots);
        expect(chart.map((s) => s.algorithm.id)).not.toContain('uncertainty');
    });
});

describe('getHeadlineSnapshot and getUncertaintySnapshot', () => {
    it('returns the rrf snapshot as headline and the uncertainty snapshot separately', () => {
        const replay = buildReplayFromVotes([[1, 2]]);
        const snapshots = buildRankingSnapshots(1, replay);
        expect(getHeadlineSnapshot(snapshots)?.algorithm.id).toBe('rrf');
        expect(getUncertaintySnapshot(snapshots)?.algorithm.id).toBe('uncertainty');
    });
});

describe('computeRankRange', () => {
    it('returns the min/max rank across primary methods only', () => {
        const replay = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
        ]);
        const snapshots = buildRankingSnapshots(1, replay);
        const range = computeRankRange(snapshots);
        expect(range).not.toBeNull();
        expect(range!.min).toBeGreaterThanOrEqual(1);
        expect(range!.max).toBeLessThanOrEqual(3);
        expect(range!.min).toBeLessThanOrEqual(range!.max);
    });

    it('returns null when no primary ranks are available', () => {
        // Movie not present → all ranks null
        const replay = buildReplayFromVotes([[1, 2]]);
        const snapshots = buildRankingSnapshots(9999, replay);
        expect(computeRankRange(snapshots)).toBeNull();
    });
});
