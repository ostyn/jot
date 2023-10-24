import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import feather, { FeatherIconNames } from "feather-icons";

@customElement("feather-icon")
export class FeatherIcon extends LitElement {
  @property()
  name?: FeatherIconNames;
  render() {
    if (this.name) return unsafeHTML(feather.icons[this.name].toSvg());
    return;
  }
}
