import { css, unsafeCSS } from 'lit';
import base from './base.css?inline';
import pico from '/node_modules/@picocss/pico/css/pico.min.css?inline';

export default css`
    ${unsafeCSS(pico)}, ${unsafeCSS(base)}
` as any;
