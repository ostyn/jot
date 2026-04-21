import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import '../components/utility-page-header.component';
import {
    type Direction,
    type Tile,
    applyMove,
    hasLegalMove,
} from '../utils/game-2048';

const SLIDE_PER_CELL_MS = 55;
const SLIDE_BASE_MS = 30;
const POP_MS = 160;
const SPAWN_MS = 140;

const slideDurationFor = (distance: number) =>
    SLIDE_BASE_MS + Math.max(1, distance) * SLIDE_PER_CELL_MS;

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

    handleDirection(direction: Direction) {
        if (this.isAnimating || this.defeated) return;
        const { moved, scoreDelta, maxSlideDistance } = applyMove(
            this.tiles,
            direction
        );
        if (!moved) return;
        this.score += scoreDelta;
        this.isAnimating = true;
        this.requestUpdate();

        const slideMs = slideDurationFor(maxSlideDistance);

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
            if (!hasLegalMove(this.tiles)) this.defeated = true;
            this.saveGameState();
            this.isAnimating = false;
            this.requestUpdate();
        }, slideMs);

        setTimeout(
            () => {
                this.tiles.forEach((t) => {
                    t.isNew = false;
                    t.merged = false;
                });
                this.requestUpdate();
            },
            slideMs + Math.max(POP_MS, SPAWN_MS) + 20
        );
    }

    private renderTile(tile: Tile) {
        const slideMs = slideDurationFor(tile.slideDistance ?? 0);
        return html`
            <div
                class="tile game-tile"
                data-value="${tile.value}"
                ?data-new="${tile.isNew}"
                ?data-merged="${tile.merged}"
                ?data-exiting="${tile.exiting}"
                style="--row:${tile.row};--col:${tile.col};--slide-ms:${slideMs}ms"
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
        const map: Record<string, Direction> = {
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right',
        };
        const direction = map[event.key];
        if (direction) this.handleDirection(direction);
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
                    transform var(--slide-ms, 110ms) ease-out,
                    opacity var(--slide-ms, 110ms) ease-out,
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
