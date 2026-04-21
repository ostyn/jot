import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import '../components/utility-page-header.component';

interface Tile {
    id: number;
    row: number;
    col: number;
    value: number;
    isNew?: boolean;
    merged?: boolean;
    mergedTo?: number;
    exiting?: boolean;
}

const SLIDE_MS = 110;
const POP_MS = 160;
const SPAWN_MS = 140;

@customElement('game-route')
export class GameRoute extends MobxLitElement {
    tiles: Tile[] = [];
    gesture!: TinyGesture;
    defeated = false;
    score = 0;
    highScore = 0;
    private nextId = 1;
    private isAnimating = false;

    constructor() {
        super();
        this.loadGameState();
    }

    private tileAt(row: number, col: number): Tile | undefined {
        return this.tiles.find(
            (t) => !t.exiting && t.row === row && t.col === col
        );
    }

    private emptyCells(): [number, number][] {
        const occupied = new Set(
            this.tiles
                .filter((t) => !t.exiting)
                .map((t) => `${t.row},${t.col}`)
        );
        const result: [number, number][] = [];
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (!occupied.has(`${r},${c}`)) result.push([r, c]);
        return result;
    }

    saveGameState() {
        localStorage.setItem(
            'gameState',
            JSON.stringify({
                tiles: this.tiles
                    .filter((t) => !t.exiting)
                    .map(({ row, col, value }) => ({ row, col, value })),
                defeated: this.defeated,
                score: this.score,
                highScore: this.highScore,
            })
        );
    }

    loadGameState() {
        const saved = localStorage.getItem('gameState');
        if (!saved) {
            this.newGame();
            return;
        }
        const parsed = JSON.parse(saved);
        this.score = parsed.score ?? 0;
        this.highScore = parsed.highScore ?? 0;
        this.defeated = parsed.defeated ?? false;
        if (Array.isArray(parsed.tiles)) {
            this.tiles = parsed.tiles.map((t: any) => ({
                id: this.nextId++,
                row: t.row,
                col: t.col,
                value: t.value,
            }));
        } else if (Array.isArray(parsed.board)) {
            this.tiles = [];
            parsed.board.forEach((row: any[], r: number) =>
                row.forEach((v, c) => {
                    if (v)
                        this.tiles.push({
                            id: this.nextId++,
                            row: r,
                            col: c,
                            value: v,
                        });
                })
            );
        } else {
            this.newGame();
        }
    }

    newGame() {
        this.tiles = [];
        this.defeated = false;
        this.score = 0;
        this.spawnTile();
        this.spawnTile();
        this.saveGameState();
        this.requestUpdate();
    }

    private spawnTile() {
        const empties = this.emptyCells();
        if (!empties.length) return;
        const [row, col] = empties[Math.floor(Math.random() * empties.length)];
        this.tiles.push({
            id: this.nextId++,
            row,
            col,
            value: Math.random() < 0.9 ? 2 : 4,
            isNew: true,
        });
    }

    private hasLegalMove(): boolean {
        if (this.tiles.length < 16) return true;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
                const t = this.tileAt(r, c);
                if (!t) return true;
                if (c < 3 && this.tileAt(r, c + 1)?.value === t.value)
                    return true;
                if (r < 3 && this.tileAt(r + 1, c)?.value === t.value)
                    return true;
            }
        return false;
    }

    handleDirection(direction: string) {
        if (this.isAnimating || this.defeated) return;
        const moved = this.applyMove(direction);
        if (!moved) return;
        this.isAnimating = true;
        this.requestUpdate();

        setTimeout(() => {
            this.tiles = this.tiles.filter((t) => !t.exiting);
            this.tiles.forEach((t) => {
                if (t.mergedTo !== undefined) {
                    t.value = t.mergedTo;
                    t.mergedTo = undefined;
                    t.merged = true;
                }
            });
            this.spawnTile();
            this.highScore = Math.max(this.highScore, this.score);
            if (!this.hasLegalMove()) this.defeated = true;
            this.saveGameState();
            this.isAnimating = false;
            this.requestUpdate();
        }, SLIDE_MS);

        setTimeout(
            () => {
                this.tiles.forEach((t) => {
                    t.isNew = false;
                    t.merged = false;
                });
                this.requestUpdate();
            },
            SLIDE_MS + Math.max(POP_MS, SPAWN_MS) + 20
        );
    }

    private applyMove(direction: string): boolean {
        this.tiles.forEach((t) => {
            t.isNew = false;
            t.merged = false;
            t.mergedTo = undefined;
        });

        const horizontal = direction === 'left' || direction === 'right';
        const reverse = direction === 'right' || direction === 'down';
        let anyMoved = false;

        for (let line = 0; line < 4; line++) {
            const lineTiles: Tile[] = [];
            for (let pos = 0; pos < 4; pos++) {
                const r = horizontal ? line : pos;
                const c = horizontal ? pos : line;
                const t = this.tileAt(r, c);
                if (t) lineTiles.push(t);
            }
            if (reverse) lineTiles.reverse();

            const slots: { winner: Tile; loser?: Tile }[] = [];
            for (let i = 0; i < lineTiles.length; ) {
                const a = lineTiles[i];
                const b = lineTiles[i + 1];
                if (b && a.value === b.value) {
                    a.mergedTo = a.value * 2;
                    this.score += a.value * 2;
                    slots.push({ winner: a, loser: b });
                    i += 2;
                } else {
                    slots.push({ winner: a });
                    i += 1;
                }
            }

            slots.forEach((slot, idx) => {
                const pos = reverse ? 3 - idx : idx;
                const newR = horizontal ? line : pos;
                const newC = horizontal ? pos : line;
                if (slot.winner.row !== newR || slot.winner.col !== newC)
                    anyMoved = true;
                slot.winner.row = newR;
                slot.winner.col = newC;
                if (slot.loser) {
                    slot.loser.row = newR;
                    slot.loser.col = newC;
                    slot.loser.exiting = true;
                    anyMoved = true;
                }
            });
        }

        return anyMoved;
    }

    private renderTile(tile: Tile) {
        return html`
            <div
                class="tile game-tile"
                data-value="${tile.value}"
                ?data-new="${tile.isNew}"
                ?data-merged="${tile.merged}"
                ?data-exiting="${tile.exiting}"
                style="--row:${tile.row};--col:${tile.col}"
            >
                ${tile.value}
            </div>
        `;
    }

    render() {
        const cells = [];
        for (let i = 0; i < 16; i++)
            cells.push(html`<div class="cell"></div>`);

        return html`
            <utility-page-header title="2048"></utility-page-header>
            <div class="scoreboard">
                <div class="title-container">
                    <div class="title">
                        <div class="tile" data-value="2">2</div>
                        <div class="tile" data-value="2048">0</div>
                        <div class="tile" data-value="4">4</div>
                        <div class="tile" data-value="8">8</div>
                    </div>
                </div>
                <span class="controls">
                    <hgroup>
                        <h2>Score: ${this.score}</h2>
                        <h2>High Score: ${this.highScore}</h2>
                    </hgroup>
                    <button @click="${() => this.newGame()}">Restart</button>
                </span>
            </div>

            <div class="game-container">
                ${cells}
                ${repeat(
                    this.tiles,
                    (t) => t.id,
                    (t) => this.renderTile(t)
                )}
                ${this.defeated
                    ? html`
                          <div class="defeat-overlay">
                              <div class="defeat-screen">Game Over</div>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }

    keyDownHandler = (event: KeyboardEvent) => {
        if (event.key.startsWith('Arrow')) {
            const direction = event.key.toLowerCase().split('arrow')[1];
            this.handleDirection(direction);
        }
    };

    connectedCallback() {
        super.connectedCallback();
        this.gesture = new TinyGesture(this, {
            velocityThreshold: 0.3,
            threshold: () =>
                Math.max(
                    25,
                    Math.floor(
                        0.15 * (window.innerWidth || document.body.clientWidth)
                    )
                ),
        });
        this.gesture.on('swipeup', () => this.handleDirection('up'));
        this.gesture.on('swipedown', () => this.handleDirection('down'));
        this.gesture.on('swipeleft', () => this.handleDirection('left'));
        this.gesture.on('swiperight', () => this.handleDirection('right'));
        window.addEventListener('keydown', this.keyDownHandler);
    }

    disconnectedCallback() {
        this.gesture.destroy();
        window.removeEventListener('keydown', this.keyDownHandler);
        super.disconnectedCallback();
    }

    static styles = [
        base,
        css`
            :host {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                align-items: start;
            }
            .title-container {
                width: 120px;
            }
            .controls {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                text-align: right;
            }
            .scoreboard {
                padding-top: 4rem;
                padding-bottom: 6rem;
                display: flex;
                justify-content: space-between;
                font-size: 1.5rem;
                width: 100%;
                align-items: center;
            }
            .game-container {
                --gap: 10px;
                width: 100%;
                max-width: 500px;
                aspect-ratio: 1 / 1;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                grid-template-rows: repeat(4, 1fr);
                gap: var(--gap);
                background-color: #bbada0;
                border-radius: 6px;
                padding: var(--gap);
                position: relative;
                margin: auto;
                user-select: none;
                touch-action: none;
            }
            .cell {
                background-color: rgba(238, 228, 218, 0.35);
                border-radius: 6px;
            }
            .title {
                display: inline-grid;
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
                gap: 4px;
                background-color: #bbada0;
                border-radius: 6px;
                padding: 4px;
                margin: auto;
                position: relative;
            }
            .tile {
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: clamp(16px, 6vw, 36px);
                font-weight: bold;
                border-radius: 6px;
                color: white;
                background-color: #cdc1b4;
                transition: background-color 0.2s;
                aspect-ratio: 1 / 1;
            }
            .game-tile {
                position: absolute;
                top: var(--gap);
                left: var(--gap);
                width: calc((100% - 5 * var(--gap)) / 4);
                transform: translate(
                    calc(var(--col) * (100% + var(--gap))),
                    calc(var(--row) * (100% + var(--gap)))
                );
                transition:
                    transform ${SLIDE_MS}ms ease-out,
                    opacity ${SLIDE_MS}ms ease-out,
                    background-color 0.2s;
                will-change: transform;
                z-index: 1;
            }
            .game-tile[data-exiting] {
                opacity: 0;
                z-index: 0;
            }
            .game-tile[data-merged] {
                animation: merge-pop ${POP_MS}ms ease-out;
                z-index: 3;
            }
            .game-tile[data-new] {
                animation: spawn ${SPAWN_MS}ms ease-out;
                z-index: 2;
            }
            @keyframes spawn {
                0% {
                    transform: translate(
                            calc(var(--col) * (100% + var(--gap))),
                            calc(var(--row) * (100% + var(--gap)))
                        )
                        scale(0);
                    opacity: 0;
                }
                60% {
                    transform: translate(
                            calc(var(--col) * (100% + var(--gap))),
                            calc(var(--row) * (100% + var(--gap)))
                        )
                        scale(1.08);
                    opacity: 1;
                }
                100% {
                    transform: translate(
                            calc(var(--col) * (100% + var(--gap))),
                            calc(var(--row) * (100% + var(--gap)))
                        )
                        scale(1);
                }
            }
            @keyframes merge-pop {
                0% {
                    transform: translate(
                            calc(var(--col) * (100% + var(--gap))),
                            calc(var(--row) * (100% + var(--gap)))
                        )
                        scale(1);
                }
                45% {
                    transform: translate(
                            calc(var(--col) * (100% + var(--gap))),
                            calc(var(--row) * (100% + var(--gap)))
                        )
                        scale(1.22);
                    box-shadow: 0 0 18px rgba(255, 255, 255, 0.45);
                }
                100% {
                    transform: translate(
                            calc(var(--col) * (100% + var(--gap))),
                            calc(var(--row) * (100% + var(--gap)))
                        )
                        scale(1);
                }
            }

            .tile[data-value='2'] {
                background-color: #eee4da;
                color: #776e65;
            }
            .tile[data-value='4'] {
                background-color: #ede0c8;
                color: #776e65;
            }
            .tile[data-value='8'] {
                background-color: #f2b179;
            }
            .tile[data-value='16'] {
                background-color: #f59563;
            }
            .tile[data-value='32'] {
                background-color: #f67c5f;
            }
            .tile[data-value='64'] {
                background-color: #f65e3b;
            }
            .tile[data-value='128'] {
                background-color: #edcf72;
            }
            .tile[data-value='256'] {
                background-color: #edcc61;
            }
            .tile[data-value='512'] {
                background-color: #edc850;
            }
            .tile[data-value='1024'] {
                background-color: #edc53f;
            }
            .tile[data-value='2048'] {
                background-color: #edc22e;
            }
            .tile[data-value='4096'] {
                background-color: #3c3a32;
            }
            .tile[data-value='8192'] {
                background-color: #3c3a32;
            }
            .defeat-overlay {
                position: absolute;
                inset: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10;
                border-radius: 6px;
            }
            .defeat-screen {
                font-size: 3rem;
                font-weight: bold;
                color: #f65e3b;
                background: white;
                padding: 1.5rem;
                border-radius: 10px;
            }
        `,
    ];
}
