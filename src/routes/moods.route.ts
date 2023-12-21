import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import '../components/calendar-wrapper.component';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';

@customElement('moods-route')
export class MoodsRoute extends MobxLitElement {
    moodSelected(mood?: Mood) {
        ActionSheetController.open({
            type: 'moodEdit',
            data: mood || {},
        });
    }
    render() {
        return html` <article>
            <header>Moods</header>
            <section>
                ${moods.userCreated.map((mood) => {
                    return html`<span
                        @click=${() => this.moodSelected(mood)}
                        class="moods-mood"
                        >${mood.emoji}</span
                    >`;
                })}
                <span class="moods-mood" @click=${() => this.moodSelected()}>
                    <jot-icon name="PlusCircle"></jot-icon>
                </span>
            </section>
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
