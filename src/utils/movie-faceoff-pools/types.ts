export interface PoolContext {
    /**
     * Union of today's TMDB pool (from ensureMovieIdPool) and decisiveIds —
     * movies the user has voted on stay in scope even if they fall out of
     * the daily JSON.
     */
    fullTmdbIds: number[];
    /** Movies with at least one vote event. From replayState. */
    decisiveIds: ReadonlySet<number>;
    /** decisive ∪ excluded ∪ unseen — every movie the user has "responded" to. */
    respondedIds: ReadonlySet<number>;
}

export type Pool = (ctx: PoolContext) => number[];

export type Pairing =
    | { kind: 'single'; pool: Pool }
    | { kind: 'cross'; left: Pool; right: Pool };

export interface ModeDef {
    id: string;
    label: string;
    pairing: Pairing;
    /**
     * Per-side empty-state copy. `which` is 'single' for single-pool modes,
     * or 'left' / 'right' for cross-pool modes.
     */
    emptyMessage: (which: 'left' | 'right' | 'single') => string;
    /**
     * Override the "Available" stat label. Defaults to "Available".
     * Cross modes use this to render e.g. "New to place" against the left
     * pool's count.
     */
    availableLabel?: string;
}
