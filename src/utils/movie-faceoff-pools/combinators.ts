import { Pool } from './types';

export const all: Pool = (ctx) => ctx.fullTmdbIds;

export const ranked: Pool = (ctx) => [...ctx.decisiveIds];

export const unresponded: Pool = (ctx) =>
    ctx.fullTmdbIds.filter((id) => !ctx.respondedIds.has(id));

export const fromList = (ids: readonly number[]): Pool => () => [...ids];

export const difference = (a: Pool, b: Pool): Pool => (ctx) => {
    const exclude = new Set(b(ctx));
    return a(ctx).filter((id) => !exclude.has(id));
};

export const intersection = (a: Pool, b: Pool): Pool => (ctx) => {
    const keep = new Set(b(ctx));
    return a(ctx).filter((id) => keep.has(id));
};
