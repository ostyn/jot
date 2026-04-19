import { describe, expect, it } from 'vitest';
import { MovieFaceoffRankedMovie } from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import {
    advanceTargetedInsertion,
    createTargetedInsertionState,
} from './movie-faceoff-targeted-insertion';

function makeTarget(id: number, title = `Movie ${id}`): FaceoffMovie {
    return { id, title };
}

function makeRanked(ids: number[]): MovieFaceoffRankedMovie[] {
    const now = new Date().toISOString();
    return ids.map((id) => ({
        id,
        title: `Movie ${id}`,
        createdAt: now,
        updatedAt: now,
        rating: 1500,
        winCount: 0,
        lossCount: 0,
    }));
}

describe('createTargetedInsertionState', () => {
    it('completes immediately when the ranked snapshot is empty', () => {
        const state = createTargetedInsertionState(makeTarget(1), [], 'manual');
        expect(state.complete).toBe(true);
        expect(state.rankedSnapshot).toEqual([]);
        expect(state.pivotMovie).toBeNull();
        expect(state.pivotIndex).toBe(-1);
    });

    it('filters the target out of the ranked snapshot', () => {
        const ranked = makeRanked([1, 2, 3]);
        const state = createTargetedInsertionState(makeTarget(2), ranked, 'manual');
        expect(state.rankedSnapshot.map((m) => m.id)).toEqual([1, 3]);
    });

    it('picks the midpoint of the ranked snapshot as the first pivot', () => {
        const ranked = makeRanked([10, 20, 30, 40, 50]);
        const state = createTargetedInsertionState(makeTarget(99), ranked, 'manual');
        // floor((0 + 5) / 2) = 2 → rankedSnapshot[2] = 30
        expect(state.pivotIndex).toBe(2);
        expect(state.pivotMovie?.id).toBe(30);
    });

    it('completes when low >= high', () => {
        const ranked = makeRanked([10, 20, 30]);
        const state = createTargetedInsertionState(
            makeTarget(99),
            ranked,
            'manual',
            0,
            3, // low = high = snapshot length
            3
        );
        expect(state.complete).toBe(true);
    });

    it('clamps high to snapshot length and low to non-negative', () => {
        const ranked = makeRanked([10, 20, 30]);
        const state = createTargetedInsertionState(
            makeTarget(99),
            ranked,
            'manual',
            0,
            -5, // low gets clamped to 0
            99 // high gets clamped to snapshot length (3)
        );
        expect(state.low).toBe(0);
        expect(state.high).toBe(3);
        expect(state.complete).toBe(false);
    });
});

describe('advanceTargetedInsertion', () => {
    it('narrows high when the target wins', () => {
        const session = createTargetedInsertionState(
            makeTarget(99),
            makeRanked([10, 20, 30, 40, 50]),
            'manual'
        );
        const { low, high, comparisonsCompleted } = advanceTargetedInsertion(session, true);
        // pivotIndex=2; target wins → high becomes 2, low stays 0
        expect(low).toBe(0);
        expect(high).toBe(2);
        expect(comparisonsCompleted).toBe(1);
    });

    it('narrows low when the target loses', () => {
        const session = createTargetedInsertionState(
            makeTarget(99),
            makeRanked([10, 20, 30, 40, 50]),
            'manual'
        );
        const { low, high, comparisonsCompleted } = advanceTargetedInsertion(session, false);
        // pivotIndex=2; target loses → low becomes 3, high stays 5
        expect(low).toBe(3);
        expect(high).toBe(5);
        expect(comparisonsCompleted).toBe(1);
    });

    it('increments comparisonsCompleted each time', () => {
        let session = createTargetedInsertionState(
            makeTarget(99),
            makeRanked([10, 20, 30]),
            'manual'
        );
        expect(session.comparisonsCompleted).toBe(0);
        const next = advanceTargetedInsertion(session, true);
        expect(next.comparisonsCompleted).toBe(1);
    });

    it('converges in O(log n) steps on a 10-movie snapshot', () => {
        const ranked = makeRanked([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        let session = createTargetedInsertionState(makeTarget(99), ranked, 'manual');
        let steps = 0;
        // Simulate the target "losing" every comparison — pushes it to the end
        while (!session.complete && steps < 20) {
            const next = advanceTargetedInsertion(session, false);
            session = createTargetedInsertionState(
                makeTarget(99),
                ranked,
                'manual',
                next.comparisonsCompleted,
                next.low,
                next.high
            );
            steps++;
        }
        expect(session.complete).toBe(true);
        // log2(10) ≈ 3.32 → should converge in at most 4 comparisons
        expect(steps).toBeLessThanOrEqual(4);
    });
});
