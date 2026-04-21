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

    it('picks a pivot within the middle third of the ranked snapshot', () => {
        const ranked = makeRanked([10, 20, 30, 40, 50, 60, 70, 80, 90]);
        const seenPivots = new Set<number>();
        for (let i = 0; i < 50; i++) {
            const state = createTargetedInsertionState(makeTarget(99), ranked, 'manual');
            seenPivots.add(state.pivotIndex);
        }
        // size=9 → band is [3, 6) → indices 3, 4, 5
        expect([...seenPivots].sort()).toEqual([3, 4, 5]);
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
    it('narrows high to the pivot when the target wins', () => {
        const session = createTargetedInsertionState(
            makeTarget(99),
            makeRanked([10, 20, 30, 40, 50]),
            'manual'
        );
        const { low, high, comparisonsCompleted } = advanceTargetedInsertion(session, true);
        expect(low).toBe(session.low);
        expect(high).toBe(session.pivotIndex);
        expect(comparisonsCompleted).toBe(1);
    });

    it('narrows low past the pivot when the target loses', () => {
        const session = createTargetedInsertionState(
            makeTarget(99),
            makeRanked([10, 20, 30, 40, 50]),
            'manual'
        );
        const { low, high, comparisonsCompleted } = advanceTargetedInsertion(session, false);
        expect(low).toBe(session.pivotIndex + 1);
        expect(high).toBe(session.high);
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
        // Middle-third pivot shrinks range by at least 1/3 each step → log_{3/2}(10) ≈ 5.68
        expect(steps).toBeLessThanOrEqual(6);
    });
});
