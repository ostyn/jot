export interface Tile {
    id: number;
    row: number;
    col: number;
    value: number;
    isNew?: boolean;
    merged?: boolean;
    mergedTo?: number;
    exiting?: boolean;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface MoveResult {
    moved: boolean;
    scoreDelta: number;
}

export function tileAt(
    tiles: Tile[],
    row: number,
    col: number
): Tile | undefined {
    return tiles.find(
        (t) => !t.exiting && t.row === row && t.col === col
    );
}

export function applyMove(tiles: Tile[], direction: Direction): MoveResult {
    tiles.forEach((t) => {
        t.isNew = false;
        t.merged = false;
        t.mergedTo = undefined;
    });

    const horizontal = direction === 'left' || direction === 'right';
    const reverse = direction === 'right' || direction === 'down';
    let moved = false;
    let scoreDelta = 0;

    for (let line = 0; line < 4; line++) {
        const lineTiles: Tile[] = [];
        for (let pos = 0; pos < 4; pos++) {
            const r = horizontal ? line : pos;
            const c = horizontal ? pos : line;
            const t = tileAt(tiles, r, c);
            if (t) lineTiles.push(t);
        }
        if (reverse) lineTiles.reverse();

        const slots: { winner: Tile; loser?: Tile }[] = [];
        for (let i = 0; i < lineTiles.length; ) {
            const a = lineTiles[i];
            const b = lineTiles[i + 1];
            if (b && a.value === b.value) {
                a.mergedTo = a.value * 2;
                scoreDelta += a.value * 2;
                slots.push({ winner: a, loser: b });
                i += 2;
            } else {
                slots.push({ winner: a });
                i += 1;
            }
        }

        slots.forEach((slot, idx) => {
            const pos = reverse ? 3 - idx : idx;
            const newR = horizontal ? line : pos;
            const newC = horizontal ? pos : line;
            if (slot.winner.row !== newR || slot.winner.col !== newC)
                moved = true;
            slot.winner.row = newR;
            slot.winner.col = newC;
            if (slot.loser) {
                slot.loser.row = newR;
                slot.loser.col = newC;
                slot.loser.exiting = true;
                moved = true;
            }
        });
    }

    return { moved, scoreDelta };
}

export function hasLegalMove(tiles: Tile[]): boolean {
    const live = tiles.filter((t) => !t.exiting);
    if (live.length < 16) return true;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const t = tileAt(live, r, c);
            if (!t) return true;
            if (c < 3 && tileAt(live, r, c + 1)?.value === t.value)
                return true;
            if (r < 3 && tileAt(live, r + 1, c)?.value === t.value)
                return true;
        }
    }
    return false;
}
