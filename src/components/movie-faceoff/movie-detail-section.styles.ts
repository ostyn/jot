import { css } from 'lit';

/**
 * Shared shell styles for the `<section class="surface-panel section-card">`
 * wrappers rendered by every movie-detail section component. Co-located styling
 * on each component rather than a global stylesheet, but shared to keep the
 * card shell consistent without copy-paste drift.
 */
export const sectionCardStyles = css`
    :host {
        display: block;
    }
    .surface-panel {
        position: relative;
        overflow: hidden;
        margin: 0;
    }
    .section-card {
        display: grid;
        gap: 1rem;
        padding: 1.25rem;
    }
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .section-header hgroup {
        margin: 0;
    }
    .section-header h3 {
        margin: 0;
        font-size: 1.05rem;
    }
    .eyebrow {
        margin: 0 0 0.15rem;
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--pico-muted-color);
    }
`;
