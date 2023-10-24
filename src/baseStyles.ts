import { css, unsafeCSS } from "lit";
import pico from "/node_modules/@picocss/pico/css/pico.min.css?inline";
import base from "./base.css?inline";
export default css`
  ${unsafeCSS(pico)}, ${unsafeCSS(base)}
` as any;
