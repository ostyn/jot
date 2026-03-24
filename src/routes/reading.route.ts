import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import '../components/reading-card.component';
import '../components/reading-done-row.component';
import '../components/action-sheets/text.sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import { reading } from '../stores/reading.store';
import { shuffle } from '../utils/reading-helpers';

@customElement('reading-route')
export class ReadingRoute extends MobxLitElement {
    @state()
    private importMessage = '';

    @state()
    private deckIds: string[] = [];

    private previousActiveIds = new Set<string>();

    private gesture?: TinyGesture<HTMLElement>;
    private gestureHost?: HTMLElement;

    connectedCallback(): void {
        super.connectedCallback();
        this.syncDeck(true);
    }

    firstUpdated(): void {
        this.attachGesture();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.gesture?.destroy();
    }

    updated(): void {
        this.syncDeck();
        this.attachGesture();
    }

    private attachGesture() {
        const card = this.renderRoot?.querySelector<HTMLElement>('.swipe-card');
        if (!card) {
            this.gesture?.destroy();
            this.gesture = undefined;
            this.gestureHost = undefined;
            return;
        }
        if (this.gestureHost === card && this.gesture) return;
        this.gesture?.destroy();
        this.gesture = new TinyGesture(card, {
            threshold: () => Math.max(60, Math.floor(window.innerWidth * 0.16)),
        });
        this.gestureHost = card;
        this.gesture.on('swiperight', () => void this.keepForLater());
        this.gesture.on('swipeleft', () => void this.removeCurrent());
    }

    private syncDeck(forceReset = false) {
        const activeIds = reading.active.map((item) => item.id);
        const activeIdSet = new Set(activeIds);
        const activeChanged =
            forceReset ||
            activeIds.length !== this.previousActiveIds.size ||
            activeIds.some((id) => !this.previousActiveIds.has(id));

        if (!activeChanged) return;

        const preserved = this.deckIds.filter((id) => activeIdSet.has(id));
        const newIds = activeIds.filter((id) => !preserved.includes(id));
        this.deckIds = [...preserved, ...shuffle(newIds)];
        this.previousActiveIds = activeIdSet;
    }

    private get currentItem() {
        return reading.active.find((item) => item.id === this.deckIds[0]);
    }

    private rotateDeck() {
        if (this.deckIds.length < 2) return;
        const [current, ...rest] = this.deckIds;
        this.deckIds = [...rest, current];
    }

    private async importLinks(text: string) {
        const importedItems = await reading.importFromText(text);
        this.importMessage = importedItems.length
            ? `Imported ${importedItems.length} link${importedItems.length === 1 ? '' : 's'}`
            : 'No new links found';
    }

    private openImportSheet() {
        Sheet.open({
            type: TextSheet,
            data: { text: '', initialHeight: 70 },
            onClose: (text?: string) => {
                if (text?.trim()) {
                    void this.importLinks(text);
                }
            },
        });
    }

    private keepForLater() {
        this.rotateDeck();
    }

    private async removeCurrent() {
        const current = this.currentItem;
        if (!current) return;
        this.deckIds = this.deckIds.filter((id) => id !== current.id);
        await reading.deleteItem(current.id);
    }

    private async markCurrentOpened() {
        const current = this.currentItem;
        if (!current) return;
        await reading.markOpened(current.id);
    }

    private async markDone() {
        const current = this.currentItem;
        if (!current) return;
        this.deckIds = this.deckIds.filter((id) => id !== current.id);
        await reading.markDone(current.id);
    }

    private async retryCurrentPreview() {
        const current = this.currentItem;
        if (!current) return;
        await reading.retryMetadata(current.id);
    }

    render() {
        const current = this.currentItem;
        return html`
            ${this.importMessage
                ? html`<p class="import-message">${this.importMessage}</p>`
                : nothing}

            <section class="current-stack">
                ${current
                    ? html`<reading-card
                          class="swipe-card"
                          .item=${current}
                          .activeCount=${reading.active.length}
                          @reading-add-links=${() => this.openImportSheet()}
                          @reading-open=${() => this.markCurrentOpened()}
                          @reading-later=${() => this.keepForLater()}
                          @reading-done=${() => this.markDone()}
                          @reading-remove=${() => this.removeCurrent()}
                          @reading-retry=${() => this.retryCurrentPreview()}
                      ></reading-card>`
                    : nothing}
                ${!current
                    ? html`<section class="empty-state">
                          <h2>Nothing queued</h2>
                          <p>
                              Add numbered links or one URL per line, then work
                              through them here.
                          </p>
                          <button class="inline" @click=${() => this.openImportSheet()}>
                              Add Links
                          </button>
                      </section>`
                    : nothing}
            </section>

            <article class="done-stack">
                <header class="page-header">
                    <h2>Done</h2>
                    <small>${reading.done.length}</small>
                </header>
                <div class="done-list">
                    ${reading.done.length
                        ? repeat(
                              reading.done,
                              (item) => item.id,
                              (item) => html`<reading-done-row
                                  .item=${item}
                                  @reading-requeue=${() => void reading.requeue(item.id)}
                                  @reading-retry=${() =>
                                      void reading.retryMetadata(item.id)}
                              ></reading-done-row>`
                          )
                        : html`<p class="empty-copy">Nothing completed yet.</p>`}
                </div>
            </article>
        `;
    }

    static styles = [
        base,
        css`
            .page-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                margin-bottom: 0.75rem;
            }
            .page-header h2 {
                margin: 0;
                font-size: 1rem;
            }
            .import-message {
                display: block;
                color: var(--pico-muted-color);
                margin: 0 0 1rem;
            }
            .current-stack {
                padding-top: 0.25rem;
            }
            .done-stack {
                margin-top: 1.25rem;
            }
            .done-list {
                display: flex;
                flex-direction: column;
            }
            .empty-state,
            .empty-copy {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 0.5rem 0;
            }
        `,
    ];
}
