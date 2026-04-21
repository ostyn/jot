import { describe, expect, it } from 'vitest';
import { applyMove, hasLegalMove, type Tile } from './game-2048';

type Grid = (number | null)[][];

function tilesFromGrid(grid: Grid): Tile[] {
    let id = 1;
    const tiles: Tile[] = [];
    grid.forEach((row, r) =>
        row.forEach((v, c) => {
            if (v != null)
                tiles.push({ id: id++, row: r, col: c, value: v });
        })
    );
    return tiles;
}

function row(values: (number | null)[]): Grid {
    const padded = [...values, null, null, null, null].slice(0, 4);
    const blank = (): (number | null)[] => [null, null, null, null];
    return [padded, blank(), blank(), blank()];
}

function column(values: (number | null)[]): Grid {
    const padded = [...values, null, null, null, null].slice(0, 4);
    return [0, 1, 2, 3].map((r) => [
        padded[r],
        null,
        null,
        null,
    ]);
}

/** Post-phase-2 grid: exiting tiles removed, mergedTo values applied. */
function settledGrid(tiles: Tile[]): Grid {
    const grid: Grid = Array.from({ length: 4 }, () => Array(4).fill(null));
    tiles
        .filter((t) => !t.exiting)
        .forEach((t) => {
            grid[t.row][t.col] = t.mergedTo ?? t.value;
        });
    return grid;
}

function firstRow(tiles: Tile[]): (number | null)[] {
    return settledGrid(tiles)[0];
}

function firstCol(tiles: Tile[]): (number | null)[] {
    return settledGrid(tiles).map((r) => r[0]);
}

describe('applyMove — sliding', () => {
    it('slides a lone tile to the left wall', () => {
        const tiles = tilesFromGrid(row([null, null, 2, null]));
        const { moved } = applyMove(tiles, 'left');
        expect(moved).toBe(true);
        expect(firstRow(tiles)).toEqual([2, null, null, null]);
    });

    it('slides a lone tile to the right wall', () => {
        const tiles = tilesFromGrid(row([2, null, null, null]));
        applyMove(tiles, 'right');
        expect(firstRow(tiles)).toEqual([null, null, null, 2]);
    });

    it('slides a lone tile to the top wall', () => {
        const tiles = tilesFromGrid(column([null, null, 2, null]));
        applyMove(tiles, 'up');
        expect(firstCol(tiles)).toEqual([2, null, null, null]);
    });

    it('slides a lone tile to the bottom wall', () => {
        const tiles = tilesFromGrid(column([2, null, null, null]));
        applyMove(tiles, 'down');
        expect(firstCol(tiles)).toEqual([null, null, null, 2]);
    });

    it('closes interior gaps when packing', () => {
        const tiles = tilesFromGrid(row([2, null, 4, null]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([2, 4, null, null]);
    });

    it('reports moved:false when nothing changes', () => {
        const tiles = tilesFromGrid(row([2, 4, 8, 16]));
        const { moved, scoreDelta } = applyMove(tiles, 'left');
        expect(moved).toBe(false);
        expect(scoreDelta).toBe(0);
    });

    it('reports moved:false for a pattern with no merges or slides', () => {
        const tiles = tilesFromGrid(row([2, 4, 2, 4]));
        const { moved } = applyMove(tiles, 'left');
        expect(moved).toBe(false);
    });
});

describe('applyMove — merging', () => {
    it('merges two equal adjacent tiles', () => {
        const tiles = tilesFromGrid(row([2, 2, null, null]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([4, null, null, null]);
    });

    it('merges two equal tiles across a gap', () => {
        const tiles = tilesFromGrid(row([null, 2, null, 2]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([4, null, null, null]);
    });

    it('[2,2,2,2] → [4,4,_,_] (pairs merge from the wall, never [8,_,_,_])', () => {
        const tiles = tilesFromGrid(row([2, 2, 2, 2]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([4, 4, null, null]);
    });

    it('[2,2,4,4] → [4,8,_,_] (two independent merges)', () => {
        const tiles = tilesFromGrid(row([2, 2, 4, 4]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([4, 8, null, null]);
    });

    it('[4,4,4,4] → [8,8,_,_]', () => {
        const tiles = tilesFromGrid(row([4, 4, 4, 4]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([8, 8, null, null]);
    });

    it('reports moved:true on a merge even when the winner stays put', () => {
        const tiles = tilesFromGrid(row([2, 2, null, null]));
        const { moved } = applyMove(tiles, 'left');
        expect(moved).toBe(true);
    });
});

describe('applyMove — locked-after-merge rule', () => {
    it('a sliding pre-existing tile does not re-merge with a freshly merged tile', () => {
        // Without the rule we would get [8,_,_,_]; the rule pins it to [4,4,_,_].
        const tiles = tilesFromGrid(row([2, 2, 4, null]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([4, 4, null, null]);
    });

    it('tiles behind a merge do not chain through it', () => {
        // [4,2,2,4] left: the inner 2s merge into a 4; the outer 4s stay put.
        const tiles = tilesFromGrid(row([4, 2, 2, 4]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([4, 4, 4, null]);
    });

    it('preserves a newly-merged tile next to a pre-existing one of the same value', () => {
        // [2,4,4,4] left: middle 4+4 merge → 8; trailing 4 cannot merge into it.
        const tiles = tilesFromGrid(row([2, 4, 4, 4]));
        applyMove(tiles, 'left');
        expect(firstRow(tiles)).toEqual([2, 8, 4, null]);
    });
});

describe('applyMove — direction symmetry', () => {
    it('right is the mirror of left', () => {
        const tiles = tilesFromGrid(row([2, 2, 4, 4]));
        applyMove(tiles, 'right');
        expect(firstRow(tiles)).toEqual([null, null, 4, 8]);
    });

    it('up merges along columns', () => {
        const tiles = tilesFromGrid(column([2, 2, 4, 4]));
        applyMove(tiles, 'up');
        expect(firstCol(tiles)).toEqual([4, 8, null, null]);
    });

    it('down is the mirror of up', () => {
        const tiles = tilesFromGrid(column([2, 2, 4, 4]));
        applyMove(tiles, 'down');
        expect(firstCol(tiles)).toEqual([null, null, 4, 8]);
    });

    it('each of the four rows is processed independently', () => {
        const grid: Grid = [
            [2, 2, null, null],
            [null, null, 4, 4],
            [8, null, null, 8],
            [null, 16, 16, null],
        ];
        const tiles = tilesFromGrid(grid);
        applyMove(tiles, 'left');
        expect(settledGrid(tiles)).toEqual([
            [4, null, null, null],
            [8, null, null, null],
            [16, null, null, null],
            [32, null, null, null],
        ]);
    });
});

describe('applyMove — score', () => {
    it('awards 0 when nothing merges', () => {
        const tiles = tilesFromGrid(row([2, null, 4, null]));
        const { scoreDelta } = applyMove(tiles, 'left');
        expect(scoreDelta).toBe(0);
    });

    it('awards the doubled value for a single merge', () => {
        const tiles = tilesFromGrid(row([2, 2, null, null]));
        expect(applyMove(tiles, 'left').scoreDelta).toBe(4);
    });

    it('awards 8 for a 4+4 merge', () => {
        const tiles = tilesFromGrid(row([4, 4, null, null]));
        expect(applyMove(tiles, 'left').scoreDelta).toBe(8);
    });

    it('sums across multiple merges in one move', () => {
        // 2+2=4, 4+4=8 → 12
        const tiles = tilesFromGrid(row([2, 2, 4, 4]));
        expect(applyMove(tiles, 'left').scoreDelta).toBe(12);
    });

    it('sums across multiple rows', () => {
        const grid: Grid = [
            [2, 2, null, null],
            [4, 4, null, null],
            [8, 8, null, null],
            [16, 16, null, null],
        ];
        const tiles = tilesFromGrid(grid);
        expect(applyMove(tiles, 'left').scoreDelta).toBe(4 + 8 + 16 + 32);
    });
});

describe('applyMove — merge & exit metadata', () => {
    it('winner keeps its id and gets mergedTo; value is deferred to phase 2', () => {
        const tiles = tilesFromGrid(row([2, 2, null, null]));
        applyMove(tiles, 'left');
        const winner = tiles.find((t) => !t.exiting);
        expect(winner?.value).toBe(2);
        expect(winner?.mergedTo).toBe(4);
    });

    it('loser is flagged exiting and positioned at the winner’s destination for the slide', () => {
        const tiles = tilesFromGrid(row([2, 2, null, null]));
        applyMove(tiles, 'left');
        const winner = tiles.find((t) => !t.exiting)!;
        const loser = tiles.find((t) => t.exiting)!;
        expect(loser.row).toBe(winner.row);
        expect(loser.col).toBe(winner.col);
    });

    it('clears isNew / merged / mergedTo flags from the previous render before recomputing', () => {
        const tiles = tilesFromGrid(row([2, null, null, null]));
        tiles[0].isNew = true;
        tiles[0].merged = true;
        tiles[0].mergedTo = 999;
        applyMove(tiles, 'right');
        expect(tiles[0].isNew).toBe(false);
        expect(tiles[0].merged).toBe(false);
        expect(tiles[0].mergedTo).toBeUndefined();
    });
});

describe('applyMove — slide distance', () => {
    it('records 0 distance on a no-op move', () => {
        const tiles = tilesFromGrid(row([2, 4, 8, 16]));
        const { maxSlideDistance } = applyMove(tiles, 'left');
        expect(maxSlideDistance).toBe(0);
        expect(tiles.every((t) => (t.slideDistance ?? 0) === 0)).toBe(true);
    });

    it('records distance 1 for a one-cell slide', () => {
        const tiles = tilesFromGrid(row([null, 2, null, null]));
        const { maxSlideDistance } = applyMove(tiles, 'left');
        expect(maxSlideDistance).toBe(1);
        expect(tiles[0].slideDistance).toBe(1);
    });

    it('records distance 3 for a full-board slide', () => {
        const tiles = tilesFromGrid(row([null, null, null, 2]));
        const { maxSlideDistance } = applyMove(tiles, 'left');
        expect(maxSlideDistance).toBe(3);
        expect(tiles[0].slideDistance).toBe(3);
    });

    it('returns the maximum distance across all sliding tiles', () => {
        // col 0 slides 3 (from col 3 to col 0); col 1 slides 1 (from col 2 to col 1)
        const tiles = tilesFromGrid(row([null, null, 4, 2]));
        const { maxSlideDistance } = applyMove(tiles, 'left');
        expect(maxSlideDistance).toBe(2);
    });

    it('records distance for a merge loser sliding into the winner’s cell', () => {
        // [2, null, null, 2] left → both tiles go to col 0; loser slides 3 cells.
        const tiles = tilesFromGrid(row([2, null, null, 2]));
        const { maxSlideDistance } = applyMove(tiles, 'left');
        const winner = tiles.find((t) => !t.exiting)!;
        const loser = tiles.find((t) => t.exiting)!;
        expect(winner.slideDistance).toBe(0);
        expect(loser.slideDistance).toBe(3);
        expect(maxSlideDistance).toBe(3);
    });

    it('clears stale slideDistance from the previous move', () => {
        const tiles = tilesFromGrid(row([null, null, null, 2]));
        applyMove(tiles, 'left');
        expect(tiles[0].slideDistance).toBe(3);
        // No-op move should zero it out.
        applyMove(tiles, 'left');
        expect(tiles[0].slideDistance).toBe(0);
    });
});

describe('hasLegalMove', () => {
    it('is legal when any cell is empty', () => {
        const tiles = tilesFromGrid(row([2, 4, 8, null]));
        expect(hasLegalMove(tiles)).toBe(true);
    });

    it('is legal on a full board with a horizontal adjacent match', () => {
        const grid: Grid = [
            [2, 4, 8, 16],
            [4, 2, 16, 8],
            [8, 16, 2, 4],
            [16, 8, 4, 4],
        ];
        expect(hasLegalMove(tilesFromGrid(grid))).toBe(true);
    });

    it('is legal on a full board with a vertical adjacent match', () => {
        const grid: Grid = [
            [2, 4, 8, 16],
            [4, 2, 16, 8],
            [8, 16, 2, 4],
            [8, 2, 4, 2],
        ];
        expect(hasLegalMove(tilesFromGrid(grid))).toBe(true);
    });

    it('is not legal on a full board with no adjacent matches', () => {
        const grid: Grid = [
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4],
            [4, 2, 4, 2],
        ];
        expect(hasLegalMove(tilesFromGrid(grid))).toBe(false);
    });

    it('ignores exiting tiles when checking', () => {
        // Same no-match full board, but one cell's tile is flagged exiting →
        // treat it as empty → move is legal.
        const grid: Grid = [
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4],
            [4, 2, 4, 2],
        ];
        const tiles = tilesFromGrid(grid);
        tiles[0].exiting = true;
        expect(hasLegalMove(tiles)).toBe(true);
    });
});
