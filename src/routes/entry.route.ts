import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
@customElement("entry-route")
export class EntryRoute extends LitElement {
  render() {
    return html`Entry`;
  }
  static routeRender() {
    return html`<link
        rel="stylesheet"
        href="/src/assets/pico.min.css"
      /><entry-route></entry-route>`;
  }
}
