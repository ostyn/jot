import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
@customElement("entries-route")
export class EntriesRoute extends LitElement {
  render() {
    return html`Entries`;
  }
  static routeRender() {
    return html`<link
        rel="stylesheet"
        href="/src/assets/pico.min.css"
      /><entries-route></entries-route>`;
  }
}
