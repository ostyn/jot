import { describe, expect, it } from 'vitest';
import {
    all,
    difference,
    fromList,
    intersection,
    ranked,
    unresponded,
} from './combinators';
import { PoolContext } from './types';

function makeCtx(overrides: Partial<PoolContext> = {}): PoolContext {
    return {
        fullTmdbIds: [1, 2, 3, 4, 5],
        decisiveIds: new Set([1, 2]),
        respondedIds: new Set([1, 2]),
        ...overrides,
    };
}

describe('pool combinators', () => {
    it('all returns the full TMDB pool unchanged', () => {
        expect(all(makeCtx())).toEqual([1, 2, 3, 4, 5]);
    });

    it('ranked returns only decisive ids', () => {
        expect(ranked(makeCtx())).toEqual([1, 2]);
    });

    it('unresponded subtracts respondedIds (which includes excluded/unseen)', () => {
        const ctx = makeCtx({
            decisiveIds: new Set([1]),
            respondedIds: new Set([1, 3, 4]), // 1 voted, 3 excluded, 4 unseen
        });
        expect(unresponded(ctx)).toEqual([2, 5]);
    });

    it('fromList yields a pool independent of context', () => {
        const bond = fromList([10, 20, 30]);
        expect(bond(makeCtx())).toEqual([10, 20, 30]);
    });

    it('difference removes ids in b from a', () => {
        const pool = difference(fromList([1, 2, 3, 4]), fromList([2, 4]));
        expect(pool(makeCtx())).toEqual([1, 3]);
    });

    it('intersection keeps only ids in both', () => {
        const pool = intersection(fromList([1, 2, 3, 4]), fromList([2, 4, 5]));
        expect(pool(makeCtx())).toEqual([2, 4]);
    });

    it('combinators compose: bond \\ ranked', () => {
        const bond = fromList([10, 20, 30]);
        const ctx = makeCtx({
            fullTmdbIds: [10, 20, 30, 40],
            decisiveIds: new Set([20, 40]),
            respondedIds: new Set([20, 40]),
        });
        const placeNewBond = difference(bond, ranked);
        expect(placeNewBond(ctx)).toEqual([10, 30]);
    });
});
