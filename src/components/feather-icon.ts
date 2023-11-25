import { css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import feather, { FeatherAttributes, FeatherIconNames } from 'feather-icons';

@customElement('feather-icon')
export class FeatherIcon extends LitElement {
    @property()
    name?: FeatherIconNames;
    @property({ type: Object })
    options?: Partial<FeatherAttributes>;
    render() {
        if (this.name)
            return unsafeHTML(feather.icons[this.name].toSvg(this.options));
        return;
    }
    static styles = [
        css`
            :host {
                line-height: 1rem;
            }
        `,
    ];
}
