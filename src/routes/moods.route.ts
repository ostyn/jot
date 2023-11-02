import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { SheetTypes } from '../components/action-sheets/action-sheet.component';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';

@customElement('moods-route')
export class MoodsRoute extends LitElement {
    @state()
    moods: Mood[] = moods.getState().userCreated;
    constructor() {
        super();
        moods.subscribe((state) => {
            this.moods = state.userCreated;
        });
    }
    moodSelected(mood: Mood) {
        ActionSheetController.open({
            type: SheetTypes.moodEdit,
            data: mood,
        });
    }
    render() {
        return html`<article>
            <section>
                ${this.moods.map((mood) => {
                    return html`<span
                        @click=${() => this.moodSelected(mood)}
                        class="moods-mood"
                        >${mood.emoji}</span
                    >`;
                })}
            </section>
            <button
                @click=${() =>
                    ActionSheetController.open({
                        type: SheetTypes.moodEdit,
                        data: {},
                    })}
            >
                new
            </button>
        </article>`;
    }
    static styles = [
        base,
        css`
            .moods-mood {
                font-size: 2rem;
                cursor: pointer;
            }
        `,
    ];
}
