import { describe, expect, it } from 'vitest';
import {
    buildReplayFromVotes,
    rankedIds,
    stubAlgorithm,
} from '../../../test/fixtures/movie-faceoff';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { consensusSchulzeRankingAlgorithm } from './consensus-schulze';

describe('consensusSchulzeRankingAlgorithm', () => {
    it('is labeled "Schulze Consensus" and marked as aggregate', () => {
        expect(consensusSchulzeRankingAlgorithm.id).toBe('consensus-schulze');
        expect(consensusSchulzeRankingAlgorithm.label).toBe('Schulze Consensus');
        expect(consensusSchulzeRankingAlgorithm.isAggregate).toBe(true);
    });

    it('returns an empty list when no primary algorithms are supplied', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(consensusSchulzeRankingAlgorithm.rank(state, [])).toEqual([]);
    });

    it('filters out other aggregates and itself from its inputs', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primary = stubAlgorithm('elo', [1, 2], state);
        const otherAggregate: MovieFaceoffRankingAlgorithm = {
            id: 'rrf',
            label: 'fake',
            description: '',
            isAggregate: true,
            rank: () => {
                throw new Error('aggregates should not call other aggregates');
            },
            formatMetric: () => '',
        };
        const ranked = consensusSchulzeRankingAlgorithm.rank(state, [
            primary,
            otherAggregate,
            consensusSchulzeRankingAlgorithm,
        ]);
        expect(ranked.map((m) => m.id)).toEqual([1, 2]);
    });

    it('produces consensus ordering when all primaries agree', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [1, 2, 3], state),
        ];
        expect(rankedIds(state, consensusSchulzeRankingAlgorithm, primaries)).toEqual([
            1, 2, 3,
        ]);
    });

    it('resolves an algorithm-level cycle by strongest consensus path', () => {
        // Three primaries vote in a Condorcet-cycle pattern, but with an
        // imbalance: 1 over 2 by all three; 2 over 3 by all three; 3 over 1
        // by only one. Schulze should pick 1 > 2 > 3 because the 3 → 1
        // edge is weakest in the consensus graph.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [3, 1, 2], state), // single dissenting vote
        ];
        expect(rankedIds(state, consensusSchulzeRankingAlgorithm, primaries)).toEqual([
            1, 2, 3,
        ]);
    });

    it('handles algorithms that rank only a subset of movies', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        // First primary ranks all three; second only ranks two.
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2], state),
        ];
        const ranked = rankedIds(state, consensusSchulzeRankingAlgorithm, primaries);
        // 1 should still be on top — both algorithms put it first.
        expect(ranked[0]).toBe(1);
        // 3 should still appear, ranked behind 1 and 2.
        expect(ranked).toContain(3);
    });

    it('formatMetric describes the consensus beat count', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        const [top] = consensusSchulzeRankingAlgorithm.rank(state, primaries);
        expect(consensusSchulzeRankingAlgorithm.formatMetric(top)).toBe(
            'beats 1 via consensus path'
        );
    });
});
