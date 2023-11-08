import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { AmpPlugin, easepick } from '@easepick/bundle';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';
import { settings } from '../stores/settings.store';
import customCss from './test.css?url';
import cssUrl from '/node_modules/@easepick/bundle/dist/index.css?url';

@customElement('moods-route')
export class MoodsRoute extends MobxLitElement {
    moodSelected(mood?: Mood) {
        ActionSheetController.open({
            type: 'moodEdit',
            data: mood || {},
        });
    }
    protected firstUpdated(): void {
        const dates = [
            '2023-11-03',
            '2023-11-07',
            '2023-11-08',
            '2023-11-11',
            '2023-11-15',
            '2023-11-16',
            '2023-11-17',
            '2023-11-21',
        ];
        new easepick.create({
            element: this.shadowRoot?.getElementById('dateinput'),
            css: [customCss, cssUrl],
            plugins: [AmpPlugin],
            inline: true,
            AmpPlugin: {
                dropdown: { months: true, years: true },
                darkMode: settings.isDark,
            },
            setup(picker: any) {
                // generate random prices
                const randomInt = (min: number, max: number) => {
                    return Math.floor(Math.random() * (max - min + 1) + min);
                };
                const prices = {} as any;
                dates.forEach((x) => {
                    prices[x] = randomInt(50, 200);
                });

                // add price to day element
                picker.on('view', (evt: any) => {
                    const { view, date, target } = evt.detail;
                    const d = date ? date.format('YYYY-MM-DD') : null;

                    if (view === 'CalendarDay' && prices[d]) {
                        const span =
                            target.querySelector('.day-price') ||
                            document.createElement('span');
                        span.className = 'day-price';
                        span.innerHTML = `😆${prices[d]}`;
                        target.append(span);
                    }
                });
            },
        } as any);
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
                    <feather-icon name="plus-circle"></feather-icon>
                </span>
            </section>
            <input style="display:none" id="dateinput" />
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
