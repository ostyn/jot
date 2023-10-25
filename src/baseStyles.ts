import { css, unsafeCSS } from 'lit';
import baseReset from './base.css?inline';
import pico from '/node_modules/@picocss/pico/css/pico.min.css?inline';

export const base = css`
    ${unsafeCSS(pico)}, ${unsafeCSS(baseReset)}
` as any;
