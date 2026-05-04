import { all, ranked, unresponded } from './combinators';
import { ModeDef } from './types';

export const MODES: readonly ModeDef[] = [
    {
        id: 'all',
        label: 'All movies',
        pairing: { kind: 'single', pool: all },
        emptyMessage: () => 'No movies are available right now.',
    },
    {
        id: 'ranked',
        label: 'My movies',
        pairing: { kind: 'single', pool: ranked },
        emptyMessage: () =>
            'Rank at least two movies before using ranked-only mode.',
    },
    {
        id: 'new',
        label: 'New movies',
        pairing: { kind: 'cross', left: unresponded, right: ranked },
        emptyMessage: (which) =>
            which === 'left'
                ? 'No new movies left to place.'
                : 'Rank at least one movie first, then come back to place new ones.',
        availableLabel: 'New to place',
    },
];

export const DEFAULT_MODE_ID = MODES[0].id;

/**
 * Resolve a mode id from a URL or saved value. Falls back to the default
 * mode for unknown values, and accepts the legacy `?pool=mine` alias.
 */
export function getMode(id: string | null | undefined): ModeDef {
    if (id === 'mine') return MODES.find((m) => m.id === 'ranked') ?? MODES[0];
    return MODES.find((m) => m.id === id) ?? MODES[0];
}
