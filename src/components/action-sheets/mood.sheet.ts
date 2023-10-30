import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';

@customElement('mood-sheet')
export class MoodSheet extends LitElement {
    @property()
    data: any;
    render() {
        return html`test${JSON.stringify(this.data)}`;
    }
    static styles = [base];
}
