import { describe, expect, it } from 'vitest';
import { DEFAULT_MODE_ID, getMode, MODES } from './registry';
import { PoolContext } from './types';

function makeCtx(overrides: Partial<PoolContext> = {}): PoolContext {
    return {
        fullTmdbIds: [1, 2, 3, 4, 5],
        decisiveIds: new Set([1, 2]),
        respondedIds: new Set([1, 2]),
        ...overrides,
    };
}

describe('mode registry', () => {
    it('exposes the expected core mode ids in stable order', () => {
        expect(MODES.map((m) => m.id)).toEqual(['all', 'ranked', 'new']);
    });

    it('default mode is "all"', () => {
        expect(DEFAULT_MODE_ID).toBe('all');
    });
});

describe('getMode', () => {
    it('returns a known mode by id', () => {
        expect(getMode('new').id).toBe('new');
    });

    it('falls back to the default mode for unknown ids', () => {
        expect(getMode('horror').id).toBe(DEFAULT_MODE_ID);
        expect(getMode(undefined).id).toBe(DEFAULT_MODE_ID);
        expect(getMode(null).id).toBe(DEFAULT_MODE_ID);
        expect(getMode('').id).toBe(DEFAULT_MODE_ID);
    });

    it('aliases legacy "mine" to "ranked"', () => {
        expect(getMode('mine').id).toBe('ranked');
    });
});

describe('"new" mode pairing', () => {
    const newMode = getMode('new');

    it('is a cross-pool mode', () => {
        expect(newMode.pairing.kind).toBe('cross');
    });

    it('left ⊆ unresponded, right ⊆ ranked, and the two are disjoint', () => {
        if (newMode.pairing.kind !== 'cross') throw new Error('unreachable');
        const ctx = makeCtx({
            decisiveIds: new Set([1, 2]),
            respondedIds: new Set([1, 2, 3]), // 3 is excluded/unseen
        });
        const left = newMode.pairing.left(ctx);
        const right = newMode.pairing.right(ctx);

        expect(left).toEqual([4, 5]);
        expect(right).toEqual([1, 2]);
        expect(left.some((id) => right.includes(id))).toBe(false);
    });

    it('emptyMessage("left") and emptyMessage("right") return distinct copy', () => {
        const left = newMode.emptyMessage('left');
        const right = newMode.emptyMessage('right');
        expect(left).not.toEqual(right);
        expect(left).toMatch(/no new movies/i);
        expect(right).toMatch(/rank at least one/i);
    });

    it('exposes a custom availableLabel for the status-bar stat', () => {
        expect(newMode.availableLabel).toBe('New to place');
    });
});
