import { describe, expect, it } from 'vitest';
import { MovieFaceoffEvent } from '../interfaces/movie-faceoff.interface';
import { inferTargetIds } from './movie-faceoff-backfill';

function makeVote(
    id: number,
    winnerId: number,
    loserId: number,
    createdAt: string
): MovieFaceoffEvent {
    return { id, createdAt, type: 'vote', winnerId, loserId };
}

function at(offsetSeconds: number): string {
    return new Date(Date.UTC(2024, 0, 1) + offsetSeconds * 1000).toISOString();
}

describe('inferTargetIds', () => {
    it('returns an empty map when there are no events', () => {
        expect(inferTargetIds([]).size).toBe(0);
    });

    it('returns an empty map when events contain no sessions', () => {
        // All different pairs, no common movie across consecutive votes
        const events = [
            makeVote(1, 1, 2, at(0)),
            makeVote(2, 3, 4, at(10)),
            makeVote(3, 5, 6, at(20)),
        ];
        expect(inferTargetIds(events).size).toBe(0);
    });

    it('detects a run of consecutive votes sharing a common movie', () => {
        // Target = movie 99, pivots = 1, 2, 3, all within session gap
        const events = [
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 2, 99, at(30)),
            makeVote(3, 99, 3, at(60)),
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
        expect(result.get(3)).toBe(99);
    });

    it('breaks the run on a session time gap (> 5 minutes)', () => {
        // Two early votes with target=99 + one late vote 6 minutes later
        const events = [
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 99, 2, at(30)),
            makeVote(3, 99, 3, at(6 * 60 + 30)), // > 5 minute gap from vote 2
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
        expect(result.has(3)).toBe(false);
    });

    it('breaks the run on a repeated pivot', () => {
        // Target 99 vs 1, then vs 2, then vs 1 again → third vote breaks the run
        const events = [
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 2, 99, at(10)),
            makeVote(3, 99, 1, at(20)), // repeated pivot 1
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
        expect(result.has(3)).toBe(false);
    });

    it('requires at least MIN_RUN_LENGTH (2) matching votes', () => {
        // Single vote, even with a shared movie, is too short to count as a session
        const events = [
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 50, 60, at(10)), // completely different pair
        ];
        expect(inferTargetIds(events).size).toBe(0);
    });

    it('skips events without an id when writing the result map', () => {
        const events: MovieFaceoffEvent[] = [
            { createdAt: at(0), type: 'vote', winnerId: 99, loserId: 1 }, // no id
            { createdAt: at(10), type: 'vote', winnerId: 99, loserId: 2 }, // no id
        ];
        // With no ids, the result map should be empty
        expect(inferTargetIds(events).size).toBe(0);
    });

    it('detects multiple disjoint sessions', () => {
        const events = [
            // Session 1: target 99
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 99, 2, at(30)),
            // Large gap breaks sessions
            makeVote(3, 88, 10, at(20 * 60)),
            makeVote(4, 88, 11, at(20 * 60 + 10)),
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
        expect(result.get(3)).toBe(88);
        expect(result.get(4)).toBe(88);
    });

    it('sorts events by id first (createdAt is only a tiebreaker)', () => {
        // Timestamps are reversed relative to ids — id order still wins.
        // If we sorted by createdAt, id=2 at t=0 would come first and the
        // pivot-repeat rule would break the session. Trusting id order lets
        // the run extend normally.
        const events = [
            makeVote(1, 99, 1, at(30)),
            makeVote(2, 2, 99, at(0)),
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
    });

    it('picks the correct target when only one candidate forms a run', () => {
        // First vote is 99 vs 1; second and third involve 99 → target must be 99 (not 1)
        const events = [
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 2, 99, at(10)),
            makeVote(3, 99, 3, at(20)),
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
        expect(result.get(3)).toBe(99);
    });

    it('does not advance past the end of a detected session', () => {
        // Session ends at vote 2, vote 3 is unrelated
        const events = [
            makeVote(1, 99, 1, at(0)),
            makeVote(2, 99, 2, at(30)),
            makeVote(3, 50, 60, at(60)),
        ];
        const result = inferTargetIds(events);
        expect(result.get(1)).toBe(99);
        expect(result.get(2)).toBe(99);
        expect(result.has(3)).toBe(false);
    });
});
