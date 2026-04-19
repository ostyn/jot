import { MovieFaceoffEvent } from '../interfaces/movie-faceoff.interface';

const SESSION_GAP_MS = 5 * 60 * 1000;
const MIN_RUN_LENGTH = 2;

function sortEventsChronologically(events: MovieFaceoffEvent[]): MovieFaceoffEvent[] {
    return [...events]
        .filter((event) => event.type === 'vote')
        .sort(
            (a, b) =>
                (a.id ?? Number.MAX_SAFE_INTEGER) -
                    (b.id ?? Number.MAX_SAFE_INTEGER) ||
                a.createdAt.localeCompare(b.createdAt)
        );
}

function findSessionRun(
    events: MovieFaceoffEvent[],
    startIdx: number
): { targetId: number; endIdx: number } | null {
    const first = events[startIdx];
    const candidates = [first.winnerId, first.loserId];

    for (const target of candidates) {
        const pivot = target === first.winnerId ? first.loserId : first.winnerId;
        const seenPivots = new Set<number>([pivot]);
        let lastTime = Date.parse(first.createdAt);
        let endIdx = startIdx;

        for (let j = startIdx + 1; j < events.length; j++) {
            const next = events[j];
            const hasTarget = next.winnerId === target || next.loserId === target;
            if (!hasTarget) break;

            const nextTime = Date.parse(next.createdAt);
            if (nextTime - lastTime > SESSION_GAP_MS) break;

            const nextPivot = next.winnerId === target ? next.loserId : next.winnerId;
            if (seenPivots.has(nextPivot)) break;

            seenPivots.add(nextPivot);
            lastTime = nextTime;
            endIdx = j;
        }

        if (endIdx - startIdx + 1 >= MIN_RUN_LENGTH) {
            return { targetId: target, endIdx };
        }
    }

    return null;
}

export function inferTargetIds(
    events: MovieFaceoffEvent[]
): Map<number, number> {
    const sorted = sortEventsChronologically(events);
    const result = new Map<number, number>();

    let i = 0;
    while (i < sorted.length) {
        const session = findSessionRun(sorted, i);
        if (session) {
            for (let k = i; k <= session.endIdx; k++) {
                const eventId = sorted[k].id;
                if (eventId !== undefined) {
                    result.set(eventId, session.targetId);
                }
            }
            i = session.endIdx + 1;
        } else {
            i++;
        }
    }

    return result;
}
