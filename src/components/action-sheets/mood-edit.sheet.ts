import { html, LitElement, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { Mood } from '../../interfaces/mood.interface';
import { moods } from '../../stores/moods.store';
import { dispatchEvent, Events } from '../../utils/Helpers';

@customElement('mood-edit-sheet')
export class MoodEditSheet extends LitElement {
    @property({
        type: Object,
    })
    mood!: Mood;
    firstUpdated() {
        this.localMood = { ...this.mood };
    }
    @state()
    localMood!: Mood;
    deleteMood() {
        if (confirm('Sure you want to delete?')) {
            moods.getState().removeMood(this.localMood.id);
            dispatchEvent(this, Events.moodDeleted);
        }
    }
    submitMood() {
        if (this.localMood.id) moods.getState().updateMood(this.localMood);
        else moods.getState().addMood(this.localMood);
        dispatchEvent(this, Events.moodSubmitted);
    }
    static getActionSheet(
        data: any,
        submit: (data: any) => void,
        dismiss: () => void
    ): TemplateResult {
        return html`${data.id
                ? html`<header>Edit Mood</header>`
                : html`<header>New Mood</header>`}
            <mood-edit-sheet
                @moodDeleted=${dismiss}
                @moodSubmitted=${submit}
                .mood=${data}
            ></mood-edit-sheet>`;
    }
    render() {
        return html`<form action="#">
            <section>
                ${['5', '4', '3', '2', '1'].map(
                    (val) => html`
                        <label class="inline"
                            >${val}
                            <input
                                type="radio"
                                name="moodRatingGroup"
                                .value=${val}
                                .checked=${this.localMood?.rating === val}
                                @change=${(e: Event) => {
                                    this.localMood.rating = (
                                        e.target as any
                                    ).value;
                                    this.render();
                                }}
                        /></label>
                    `
                )}
            </section>
            <section>
                <input
                    class="inline"
                    type="text"
                    .value=${this.localMood?.name || ''}
                    placeholder="name"
                    @change=${(e: Event) => {
                        this.localMood.name = (e.target as any).value;
                        this.render();
                    }}
                />
                <input
                    class="inline"
                    type="text"
                    .value=${this.localMood?.emoji || ''}
                    placeholder="emoji"
                    @change=${(e: Event) => {
                        this.localMood.emoji = (e.target as any).value;
                        this.render();
                    }}
                />
            </section>
            <section>
                <button class="inline" type="button" @click=${this.submitMood}>
                    submit
                </button>
                ${this.localMood?.id
                    ? html`<button
                          type="button"
                          class="inline contrast"
                          @click=${this.deleteMood}
                      >
                          delete
                      </button>`
                    : nothing}
            </section>
        </form> `;
    }
    static styles = [base];
}
