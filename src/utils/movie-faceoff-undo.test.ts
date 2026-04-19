import { beforeEach, describe, expect, it } from 'vitest';
import { MovieFaceoffUndoManager } from './movie-faceoff-undo';
import {
    FaceoffPair,
    MAX_UNDO_ENTRIES,
    UndoEntry,
    UNDO_STACK_STORAGE_KEY,
} from './movie-faceoff-types';

function makeEntry(id: number): UndoEntry {
    const pair: FaceoffPair = [
        { id, title: `Movie ${id}` },
        { id: id + 1, title: `Movie ${id + 1}` },
    ];
    return { action: 'vote', eventId: id, pair };
}

describe('MovieFaceoffUndoManager', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('is empty on construction', () => {
        const manager = new MovieFaceoffUndoManager();
        expect(manager.hasEntries).toBe(false);
        expect(manager.length).toBe(0);
    });

    it('push and pop follow LIFO order', () => {
        const manager = new MovieFaceoffUndoManager();
        manager.push(makeEntry(1));
        manager.push(makeEntry(2));
        manager.push(makeEntry(3));

        expect(manager.length).toBe(3);
        expect(manager.pop()?.eventId).toBe(3);
        expect(manager.pop()?.eventId).toBe(2);
        expect(manager.pop()?.eventId).toBe(1);
        expect(manager.pop()).toBeUndefined();
    });

    it('caps the stack at MAX_UNDO_ENTRIES', () => {
        const manager = new MovieFaceoffUndoManager();
        for (let i = 0; i < MAX_UNDO_ENTRIES + 5; i++) {
            manager.push(makeEntry(i));
        }
        expect(manager.length).toBe(MAX_UNDO_ENTRIES);
        expect(manager.pop()?.eventId).toBe(MAX_UNDO_ENTRIES + 4);
    });

    it('clones the pair on push so mutations do not leak', () => {
        const manager = new MovieFaceoffUndoManager();
        const entry = makeEntry(1);
        manager.push(entry);
        entry.pair[0]!.title = 'MUTATED';
        const popped = manager.pop();
        expect(popped?.pair[0]?.title).toBe('Movie 1');
    });

    it('persists pushed entries to sessionStorage', () => {
        const manager = new MovieFaceoffUndoManager();
        manager.push(makeEntry(42));
        const raw = window.sessionStorage.getItem(UNDO_STACK_STORAGE_KEY);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].eventId).toBe(42);
    });

    it('restore rehydrates from sessionStorage', () => {
        window.sessionStorage.setItem(
            UNDO_STACK_STORAGE_KEY,
            JSON.stringify([makeEntry(1), makeEntry(2)])
        );

        const manager = new MovieFaceoffUndoManager();
        expect(manager.hasEntries).toBe(false);
        manager.restore();
        expect(manager.length).toBe(2);
        expect(manager.pop()?.eventId).toBe(2);
    });

    it('restore tolerates malformed JSON', () => {
        window.sessionStorage.setItem(UNDO_STACK_STORAGE_KEY, '{not valid json');
        const manager = new MovieFaceoffUndoManager();
        manager.restore();
        expect(manager.hasEntries).toBe(false);
    });

    it('restore clears existing entries when storage is empty', () => {
        const manager = new MovieFaceoffUndoManager();
        manager.push(makeEntry(1));
        window.sessionStorage.removeItem(UNDO_STACK_STORAGE_KEY);
        manager.restore();
        expect(manager.hasEntries).toBe(false);
    });

    it('restore filters out entries that fail the type guard', () => {
        window.sessionStorage.setItem(
            UNDO_STACK_STORAGE_KEY,
            JSON.stringify([
                { action: 'not-a-real-action' },
                { action: 'vote', pair: [null, null] },
                null,
            ])
        );
        const manager = new MovieFaceoffUndoManager();
        manager.restore();
        expect(manager.length).toBe(1);
    });
});
