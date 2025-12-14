import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { MoodEditSheet } from '../components/action-sheets/mood-edit.sheet';
import '../components/calendar-wrapper.component';
import '../components/mood.component';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';

@customElement('moods-route')
export class MoodsRoute extends MobxLitElement {
    moodSelected(mood?: Mood) {
        Sheet.open({
            type: MoodEditSheet,
            data: mood || {},
        });
    }
    render() {
        return html` <article>
            <header>Moods</header>
            <section>
                ${moods.userCreated.map((mood) => {
                    return html`
                        <mood-component
                            class="entry-header-emoji"
                            .mood=${mood}
                            .showName=${true}
                            @click=${() => this.moodSelected(mood)}
                        >
                        </mood-component>
                    `;
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
