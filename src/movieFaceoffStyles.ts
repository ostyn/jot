import { css } from 'lit';

export const movieFaceoffShared = css`
    hgroup {
        margin: 0;
    }
    .eyebrow {
        margin: 0 0 0.25rem;
        color: var(--pico-muted-color);
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .text-muted {
        margin: 0;
        color: var(--pico-muted-color);
    }
    ol.movie-list,
    ul.movie-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .movie-list > li {
        list-style: none;
    }
`;
