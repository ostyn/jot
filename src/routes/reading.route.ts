import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import '../components/reading-card.component';
import '../components/reading-done-row.component';
import '../components/action-sheets/text.sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import { reading } from '../stores/reading.store';
import { shuffle } from '../utils/reading-helpers';
import { betterGo } from './route-config';

@customElement('reading-route')
export class ReadingRoute
    extends MobxLitElement
    implements WebComponentInterface
{
    @state()
    private importMessage = '';

    @state()
    private deckIds: string[] = [];

    private previousActiveIds = new Set<string>();
    private visibleItemId?: string;
    private pendingFocusId?: string;
    private lastHandledShareKey?: string;
    private shareHandlingPromise?: Promise<void>;

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

    async onAfterEnter(location: RouterLocation) {
        this.pendingFocusId = location.params.id as string | undefined;
        this.applyPendingFocus();
        this.requestUpdate();
        await this.handleSharedRoute();
    }

    updated(): void {
        this.syncDeck();
        this.attachGesture();
        this.syncUrlWithCurrentItem();
        void this.ensureVisibleItemMetadata();
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
        this.applyPendingFocus();
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

    private async ensureVisibleItemMetadata() {
        const current = this.currentItem;
        if (!current || current.id === this.visibleItemId) return;
        this.visibleItemId = current.id;
        await reading.ensureMetadata(current.id);
    }

    private syncUrlWithCurrentItem() {
        const currentPath = window.location.pathname;
        if (currentPath.endsWith('/reading/share')) return;

        const focusId = this.pendingFocusId || this.currentItem?.id;
        const nextPath = focusId
            ? `/reading/${encodeURIComponent(focusId)}`
            : '/reading';

        if (currentPath === nextPath && !window.location.search) return;

        window.history.replaceState(window.history.state, '', nextPath);
    }

    private applyPendingFocus() {
        if (!this.pendingFocusId) return;
        const focusId = this.pendingFocusId;
        const focusIndex = this.deckIds.indexOf(focusId);
        if (focusIndex === -1) {
            this.pendingFocusId = undefined;
            return;
        }
        if (focusIndex > 0) {
            this.deckIds = [
                focusId,
                ...this.deckIds.slice(0, focusIndex),
                ...this.deckIds.slice(focusIndex + 1),
            ];
        }
        this.pendingFocusId = undefined;
    }

    private focusItem(id: string) {
        this.pendingFocusId = id;
        this.applyPendingFocus();
        this.requestUpdate();
        betterGo('reading-item', { pathParams: { id } });
    }

    private async handleSharedRoute() {
        const currentPath = window.location.pathname;
        if (!currentPath.endsWith('/reading/share')) return;

        const shareKey = `${currentPath}${window.location.search}`;
        if (!window.location.search || this.lastHandledShareKey === shareKey) {
            return;
        }
        if (this.shareHandlingPromise) {
            await this.shareHandlingPromise;
            return;
        }
        this.lastHandledShareKey = shareKey;
        this.shareHandlingPromise = (async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const result = await reading.importSharedPayload({
                title: searchParams.get('title') || undefined,
                text: searchParams.get('text') || undefined,
                url: searchParams.get('url') || undefined,
            });

            if (result.importedActiveItemIds.length) {
                const [focusId] = result.importedActiveItemIds;
                this.importMessage = `Imported ${result.importedActiveItemIds.length} shared link${
                    result.importedActiveItemIds.length === 1 ? '' : 's'
                }`;
                this.focusItem(focusId);
                return;
            }

            if (result.existingActiveItemIds.length) {
                const [focusId] = result.existingActiveItemIds;
                this.importMessage = 'Link already in your reading list';
                this.focusItem(focusId);
                return;
            }

            if (result.existingDoneItemIds.length) {
                this.importMessage = 'Link already in Read';
                betterGo('reading');
                return;
            }

            this.importMessage = 'No links found';
            betterGo('reading');
        })();
        try {
            await this.shareHandlingPromise;
        } finally {
            this.shareHandlingPromise = undefined;
        }
    }

    render() {
        const current = this.currentItem;
        return html`
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
                    : html`<section class="empty-state">
                          <article>
                              <header class="topbar">
                                  <h2>Reading List</h2>
                                  <button
                                      class="inline icon-only"
                                      aria-label="Add links"
                                      @click=${() => this.openImportSheet()}
                                  >
                                      <jot-icon name="Plus"></jot-icon>
                                  </button>
                              </header>
                              <p class="empty-copy">
                                  Work through your reading list, one link per
                                  line. Read it, shelve it, forget it.
                              </p>
                          </article>
                      </section>`}
                ${this.importMessage
                    ? html`<p class="status-note" role="status">
                          ${this.importMessage}
                      </p>`
                    : nothing}
            </section>

            <article class="done-stack">
                <header class="page-header">
                    <h2>Read</h2>
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
                        : html`<p class="empty-copy">Nothing read yet.</p>`}
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
            .topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                margin-bottom: 0;
                padding-bottom: 0.75rem;
                border-bottom: 1px solid var(--pico-muted-border-color);
            }
            .topbar h2 {
                margin: 0;
                font-size: 1rem;
            }
            .icon-only {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                height: 2.25rem;
                padding: 0;
                border-radius: 999px;
                border-color: var(--pico-muted-border-color);
                background: var(--pico-card-background-color);
                color: var(--pico-color);
            }
            .current-stack {
                padding-top: 0.25rem;
            }
            .status-note {
                margin: 0.625rem 0 0;
                padding: 0 0.25rem;
                color: var(--pico-muted-color);
                font-size: 0.9rem;
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
                padding-top: 0.25rem;
            }
            .empty-state article {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
        `,
    ];
}
