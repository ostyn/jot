import { EntryRoute } from "./routes/entry.route";
import { ActivitiesRoute } from "./routes/activities.route";
import { EntriesRoute } from "./routes/entries.route";
import { MoodsRoute } from "./routes/moods.route";
import { Router } from "@lit-labs/router";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import base from "./baseStyles";

@customElement("etch-app")
export class EtchApp extends LitElement {
  private _router = new Router(this, [
    { path: "/", name: "Home", render: EntriesRoute.routeRender },
    { path: "/entries", name: "Entries", render: EntriesRoute.routeRender },
    {
      path: "/moods",
      name: "Moods",
      render: MoodsRoute.routeRender,
    },
    {
      path: "/activities",
      name: "Activities",
      render: ActivitiesRoute.routeRender,
    },
    { path: "/entry", name: "Entry", render: EntryRoute.routeRender },
  ]);

  render() {
    return html`
      <header>
        ${this._router.routes.map((route: any) => {
          return html`<a href="${route.path}">${route.name}</a>`;
        })}
      </header>
      <main>${this._router.outlet()}</main>
      <footer>2023</footer>
    `;
  }
  static styles = [base];
}
