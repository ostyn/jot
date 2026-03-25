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
import '../components/utility-page-header.component';
import '../components/action-sheets/text.sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import { ReadingItem } from '../interfaces/reading-item.interface';
import { reading } from '../stores/reading.store';
import { shuffle } from '../utils/reading-helpers';
import { betterGo } from './route-config';

type UndoEntry = {
    action: 'later' | 'read' | 'remove';
    deckIds: string[];
    itemSnapshot?: ReadingItem;
    recentItemIds: string[];
};

const UNDO_STACK_STORAGE_KEY = 'reading-undo-stack-v1';
const MAX_UNDO_ENTRIES = 25;

function isUndoEntry(entry: unknown): entry is UndoEntry {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Partial<UndoEntry>;
    return Boolean(
        (candidate.action === 'later' ||
            candidate.action === 'read' ||
            candidate.action === 'remove') &&
            Array.isArray(candidate.deckIds) &&
            Array.isArray(candidate.recentItemIds)
    );
}

@customElement('reading-route')
export class ReadingRoute
    extends MobxLitElement
    implements WebComponentInterface
{
    @state()
    private statusMessage = '';

    @state()
    private showUndo = false;

    @state()
    private deckIds: string[] = [];

    @state()
    private swipeOffsetX = 0;

    @state()
    private swipeIntent: 'later' | 'remove' | '' = '';

    @state()
    private swipeSettling = false;

    private previousActiveIds = new Set<string>();
    private visibleItemId?: string;
    private pendingFocusId?: string;
    private lastHandledShareKey?: string;
    private shareHandlingPromise?: Promise<void>;
    private recentItemIds: string[] = [];

    private gesture?: TinyGesture<HTMLElement>;
    private gestureHost?: HTMLElement;
    private swipeActionTimer?: number;
    private undoStack: UndoEntry[] = [];

    connectedCallback(): void {
        super.connectedCallback();
        this.restoreUndoStack();
        if (this.undoStack.length) {
            this.statusMessage = 'Undo available';
            this.showUndo = true;
        }
        this.syncDeck(true);
    }

    firstUpdated(): void {
        this.attachGesture();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.gesture?.destroy();
        if (this.swipeActionTimer) {
            window.clearTimeout(this.swipeActionTimer);
        }
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
        const stage = this.renderRoot?.querySelector<HTMLElement>('.swipe-stage');
        if (!stage) {
            this.gesture?.destroy();
            this.gesture = undefined;
            this.gestureHost = undefined;
            return;
        }
        if (this.gestureHost === stage && this.gesture) return;
        this.gesture?.destroy();
        this.gesture = new TinyGesture(stage, {
            threshold: () => Math.max(60, Math.floor(window.innerWidth * 0.16)),
            mouseSupport: true,
        });
        this.gestureHost = stage;
        this.gesture.on('panmove', () => {
            if (this.swipeSettling) return;
            if (
                this.gesture?.swipingDirection === 'horizontal' ||
                this.gesture?.swipingDirection === 'pre-horizontal'
            ) {
                const nextOffset = this.gesture.touchMoveX ?? 0;
                this.swipeOffsetX = Math.max(-132, Math.min(132, nextOffset));
                this.swipeIntent =
                    this.swipeOffsetX < -12
                        ? 'remove'
                        : this.swipeOffsetX > 12
                          ? 'later'
                          : '';
            }
        });
        this.gesture.on('panend', () => {
            if (this.swipeSettling) return;
            const releaseOffset = this.swipeOffsetX;
            const releaseIntent = this.swipeIntent;
            if (Math.abs(releaseOffset) >= 72 && releaseIntent) {
                this.commitSwipe(releaseIntent);
                return;
            }
            window.requestAnimationFrame(() => this.resetSwipeState());
        });
        this.gesture.on('swiperight', () => {
            this.commitSwipe('later');
        });
        this.gesture.on('swipeleft', () => {
            this.commitSwipe('remove');
        });
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
        const recentSet = new Set(this.recentItemIds.filter((id) => activeIdSet.has(id)));
        const cooledNewIds = newIds.filter((id) => !recentSet.has(id));
        const deferredNewIds = newIds.filter((id) => recentSet.has(id));
        this.deckIds = [
            ...preserved,
            ...shuffle(cooledNewIds),
            ...shuffle(deferredNewIds),
        ];
        this.trimRecentHistory(activeIds.length);
        this.applyPendingFocus();
        this.previousActiveIds = activeIdSet;
    }

    private get currentItem() {
        return reading.active.find((item) => item.id === this.deckIds[0]);
    }

    private rotateDeck() {
        if (!this.deckIds.length) return;
        const [current, ...rest] = this.deckIds;
        this.rememberRecentItem(current);
        if (!rest.length) {
            this.deckIds = [current];
            return;
        }
        const activeIdSet = new Set(reading.active.map((item) => item.id));
        const recentSet = new Set(this.recentItemIds.filter((id) => activeIdSet.has(id)));
        const cooledRest = rest.filter((id) => !recentSet.has(id));
        const deferredRest = rest.filter((id) => recentSet.has(id));
        const nextDeck = [...cooledRest, ...deferredRest];
        this.deckIds = nextDeck.length ? [...nextDeck, current] : [current];
    }

    private async importLinks(text: string) {
        const importedItems = await reading.importFromText(text);
        this.statusMessage = importedItems.length
            ? `Imported ${importedItems.length} link${importedItems.length === 1 ? '' : 's'}`
            : 'No new links found';
        this.showUndo = false;
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
        this.pushUndoEntry({ action: 'later', deckIds: [...this.deckIds] });
        this.resetSwipeState();
        this.rotateDeck();
        this.statusMessage = 'Saved for later';
        this.showUndo = true;
    }

    private async removeCurrent() {
        const current = this.currentItem;
        if (!current) return;
        this.pushUndoEntry({
            action: 'remove',
            deckIds: [...this.deckIds],
            itemSnapshot: { ...current },
        });
        this.resetSwipeState();
        this.deckIds = this.deckIds.filter((id) => id !== current.id);
        await reading.deleteItem(current.id);
        this.statusMessage = 'Removed from your list';
        this.showUndo = true;
    }

    private async markCurrentOpened() {
        const current = this.currentItem;
        if (!current) return;
        await reading.markOpened(current.id);
    }

    private async markDone() {
        const current = this.currentItem;
        if (!current) return;
        this.pushUndoEntry({
            action: 'read',
            deckIds: [...this.deckIds],
            itemSnapshot: { ...current },
        });
        this.resetSwipeState();
        this.rememberRecentItem(current.id);
        this.deckIds = this.deckIds.filter((id) => id !== current.id);
        await reading.markDone(current.id);
        this.statusMessage = 'Marked as read';
        this.showUndo = true;
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

    private rememberRecentItem(id: string) {
        this.recentItemIds = this.recentItemIds.filter((itemId) => itemId !== id);
        this.recentItemIds.unshift(id);
        this.trimRecentHistory(reading.active.length);
    }

    private trimRecentHistory(activeCount: number) {
        const maxHistory = Math.max(5, Math.min(25, Math.floor(activeCount / 4)));
        this.recentItemIds = this.recentItemIds.slice(0, maxHistory);
    }

    private focusItem(id: string) {
        this.pendingFocusId = id;
        this.applyPendingFocus();
        this.requestUpdate();
        betterGo('reading-item', { pathParams: { id } });
    }

    private resetSwipeState() {
        this.swipeOffsetX = 0;
        this.swipeIntent = '';
        this.swipeSettling = false;
    }

    private commitSwipe(intent: 'later' | 'remove') {
        if (this.swipeSettling) return;
        this.swipeSettling = true;
        this.swipeIntent = intent;
        this.swipeOffsetX = intent === 'later' ? 220 : -220;
        if (this.swipeActionTimer) {
            window.clearTimeout(this.swipeActionTimer);
        }
        this.swipeActionTimer = window.setTimeout(() => {
            this.swipeActionTimer = undefined;
            if (intent === 'later') {
                this.keepForLater();
            } else {
                void this.removeCurrent();
            }
        }, 150);
    }

    private pushUndoEntry(entry: {
        action: UndoEntry['action'];
        deckIds: string[];
        itemSnapshot?: ReadingItem;
    }) {
        this.undoStack.push({
            ...entry,
            recentItemIds: [...this.recentItemIds],
        });
        this.undoStack = this.undoStack.slice(-MAX_UNDO_ENTRIES);
        this.persistUndoStack();
    }

    private async undoLastAction() {
        const entry = this.undoStack.pop();
        if (!entry) return;

        this.persistUndoStack();
        this.resetSwipeState();
        this.recentItemIds = [...entry.recentItemIds];

        if (entry.itemSnapshot) {
            await reading.restoreItem(entry.itemSnapshot);
        }

        this.deckIds = [...entry.deckIds];
        this.showUndo = this.undoStack.length > 0;
        this.statusMessage = `Undid ${entry.action}`;
        this.requestUpdate();
    }

    private persistUndoStack() {
        try {
            window.sessionStorage.setItem(
                UNDO_STACK_STORAGE_KEY,
                JSON.stringify(this.undoStack)
            );
        } catch (_error) {
            // Ignore storage failures; undo remains session-local best effort.
        }
    }

    private restoreUndoStack() {
        try {
            const raw = window.sessionStorage.getItem(UNDO_STACK_STORAGE_KEY);
            if (!raw) return;
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            this.undoStack = parsed.filter(isUndoEntry);
        } catch (_error) {
            this.undoStack = [];
        }
        this.showUndo = this.undoStack.length > 0;
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
                this.statusMessage = `Imported ${result.importedActiveItemIds.length} shared link${
                    result.importedActiveItemIds.length === 1 ? '' : 's'
                }`;
                this.showUndo = false;
                this.focusItem(focusId);
                return;
            }

            if (result.existingActiveItemIds.length) {
                const [focusId] = result.existingActiveItemIds;
                this.statusMessage = 'Link already in your reading list';
                this.showUndo = false;
                this.focusItem(focusId);
                return;
            }

            if (result.existingDoneItemIds.length) {
                this.statusMessage = 'Link already in Read';
                this.showUndo = false;
                betterGo('reading');
                return;
            }

            this.statusMessage = 'No links found';
            this.showUndo = false;
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
        const swipeProgress = Math.min(Math.abs(this.swipeOffsetX) / 132, 1);
        return html`
            <utility-page-header title="Reading List">
                <button
                    slot="actions"
                    class="inline icon-only"
                    aria-label="Add links"
                    @click=${() => this.openImportSheet()}
                >
                    <jot-icon name="Plus"></jot-icon>
                </button>
            </utility-page-header>

            <section class="current-stack">
                ${current
                    ? html`<div
                          class="swipe-stage ${this.swipeIntent}"
                          style=${`--swipe-progress:${swipeProgress};`}
                      >
                          <div class="swipe-hint swipe-hint-later">
                              <jot-icon name="ChevronRight"></jot-icon>
                              <span>Later</span>
                          </div>
                          <div class="swipe-hint swipe-hint-remove">
                              <jot-icon name="Trash2"></jot-icon>
                              <span>Remove</span>
                          </div>
                          <reading-card
                              class="swipe-card"
                              style=${`transform: translateX(${this.swipeOffsetX}px) rotate(${this.swipeOffsetX * 0.04}deg);`}
                              .item=${current}
                              .activeCount=${reading.active.length}
                              @reading-open=${() => this.markCurrentOpened()}
                              @reading-later=${() => this.keepForLater()}
                              @reading-done=${() => this.markDone()}
                              @reading-remove=${() => this.removeCurrent()}
                              @reading-retry=${() => this.retryCurrentPreview()}
                          ></reading-card>
                      </div>`
                    : html`<section class="empty-state">
                          <article>
                              <p class="empty-copy">
                                  Work through your reading list, one link per
                                  line. Read it, shelve it, forget it.
                              </p>
                          </article>
                      </section>`}
                ${this.statusMessage
                    ? html`<div class="status-note" role="status">
                          <span>${this.statusMessage}</span>
                          ${this.showUndo
                              ? html`<button
                                    class="inline subtle-action"
                                    @click=${() => void this.undoLastAction()}
                                >
                                    Undo
                                </button>`
                              : nothing}
                      </div>`
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
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                margin: 0.625rem 0 0;
                padding: 0 0.25rem;
                color: var(--pico-muted-color);
                font-size: 0.9rem;
            }
            .subtle-action {
                padding: 0;
                border: 0;
                background: transparent;
                color: var(--pico-primary);
                text-decoration: underline;
                margin-bottom: 0;
                white-space: nowrap;
            }
            .swipe-stage {
                position: relative;
                border-radius: var(--pico-border-radius);
                overflow: hidden;
                isolation: isolate;
                --swipe-progress: 0;
                background:
                    linear-gradient(
                        90deg,
                        color-mix(
                                in srgb,
                                var(--pico-primary)
                                    calc(var(--swipe-progress) * 28%),
                                transparent
                            )
                            0%,
                        transparent 34%,
                        transparent 66%,
                        color-mix(
                                in srgb,
                                var(--pico-del-color)
                                    calc(var(--swipe-progress) * 28%),
                                transparent
                            )
                            100%
                    );
            }
            .swipe-hint {
                position: absolute;
                top: 50%;
                z-index: 0;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                padding: 0.45rem 0.7rem;
                border-radius: 999px;
                font-size: 0.85rem;
                font-weight: 700;
                opacity: calc(0.16 + var(--swipe-progress) * 0.54);
                transition: opacity 120ms ease, transform 120ms ease,
                    background 120ms ease;
                pointer-events: none;
            }
            .swipe-hint jot-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1rem;
                height: 1rem;
                align-self: center;
            }
            .swipe-hint-later {
                left: 0.75rem;
                color: var(--pico-primary);
                background: color-mix(
                    in srgb,
                    var(--pico-primary) calc(10% + var(--swipe-progress) * 18%),
                    transparent
                );
            }
            .swipe-hint-remove {
                right: 0.75rem;
                color: var(--pico-del-color);
                background: color-mix(
                    in srgb,
                    var(--pico-del-color) calc(10% + var(--swipe-progress) * 18%),
                    transparent
                );
            }
            .swipe-stage.remove .swipe-hint-remove,
            .swipe-stage.later .swipe-hint-later {
                opacity: 1;
                transform: translateY(-50%) scale(1.1);
            }
            .swipe-card {
                position: relative;
                display: block;
                z-index: 1;
                transition: transform 180ms ease;
                will-change: transform;
                touch-action: pan-y;
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
