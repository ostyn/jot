import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import base from "../baseStyles";

@customElement("entries-route")
export class EntriesRoute extends LitElement {
  render() {
    return html`Entries`;
  }
  static routeRender() {
    return html`<entries-route></entries-route>`;
  }
  static styles = [base];
}
