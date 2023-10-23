import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
@customElement("activities-route")
export class ActivitiesRoute extends LitElement {
  render() {
    return html`Activities`;
  }
  static routeRender() {
    return html`<link
        rel="stylesheet"
        href="/src/assets/pico.min.css"
      /><activities-route></activities-route>`;
  }
}
