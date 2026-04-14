import {
    clonePair,
    isUndoEntry,
    MAX_UNDO_ENTRIES,
    UndoEntry,
    UNDO_STACK_STORAGE_KEY,
} from './movie-faceoff-types';

export class MovieFaceoffUndoManager {
    private stack: UndoEntry[] = [];

    get hasEntries(): boolean {
        return this.stack.length > 0;
    }

    get length(): number {
        return this.stack.length;
    }

    restore(): void {
        try {
            const raw = window.sessionStorage.getItem(UNDO_STACK_STORAGE_KEY);
            if (!raw) return;
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            this.stack = parsed.filter(isUndoEntry);
        } catch (_error) {
            this.stack = [];
        }
    }

    push(entry: UndoEntry): void {
        this.stack.push({
            ...entry,
            pair: clonePair(entry.pair),
        });
        this.stack = this.stack.slice(-MAX_UNDO_ENTRIES);
        this.persist();
    }

    pop(): UndoEntry | undefined {
        const entry = this.stack.pop();
        this.persist();
        return entry;
    }

    private persist(): void {
        try {
            window.sessionStorage.setItem(
                UNDO_STACK_STORAGE_KEY,
                JSON.stringify(this.stack)
            );
        } catch (_error) {
            // Ignore storage failures; undo remains best effort.
        }
    }
}
