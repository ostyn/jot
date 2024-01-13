import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { moods } from '../../stores/moods.store';

@customElement('moods-sheet')
export class MoodsSheet extends LitElement {
    @property()
    currentMoodId?: string = undefined;
    @property()
    onChange!: (a: any) => {};

    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<moods-sheet
            .onChange=${(moodId: any) => submit(moodId)}
            currentMoodId=${data}
        ></moods-sheet>`;
    }
    render() {
        return html`<div class="mood-container">
            ${moods.all.map((mood) => {
                return html` <label
                    class=${mood.id === this.currentMoodId
                        ? 'selected-mood inline'
                        : 'unselected-mood inline'}
                >
                    ${mood.emoji}
                    <input
                        class="input"
                        type="radio"
                        name="moodSelector"
                        value=${mood.id}
                        ?checked=${this.currentMoodId === mood.id}
                        @change=${(e: Event) => {
                            this.currentMoodId = (e.target as any).value;
                            this.onChange(this.currentMoodId);
                        }}
                    />
                </label>`;
            })}
        </div>`;
    }
    static styles = [
        base,
        css`
            :host {
                height: 100%;
            }
            .input {
                display: none;
            }
            .unselected-mood {
                font-size: 1.875rem;
                line-height: 2.25rem;
                cursor: pointer;
                opacity: 0.6;
            }
            .selected-mood {
                font-size: 2.25rem;
                line-height: 2.5rem;
                cursor: pointer;
            }
            .mood-container {
                display: flex;
                flex-wrap: wrap;
                place-content: center;
                height: 100%;
                align-items: center;
                gap: 6px;
            }
        `,
    ];
}
