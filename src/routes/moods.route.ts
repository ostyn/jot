import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import '../components/mood.component';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';
import { betterGo } from './route-config';

@customElement('moods-route')
export class MoodsRoute extends MobxLitElement {
    moodSelected(mood?: Mood) {
        betterGo('mood-edit', { pathParams: { id: mood?.id || '' } });
    }
    render() {
        return html`<slot></slot>
            <article>
                <header>Moods</header>
                <section class="moods-list">
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
                    <span
                        class="moods-mood"
                        @click=${() => this.moodSelected()}
                    >
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
            .moods-list {
                display: flex;
                justify-content: space-around;
            }
        `,
    ];
}
