import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';

@customElement('game-route')
export class GameRoute extends MobxLitElement {
    board: any;
    gesture!: TinyGesture;
    defeated = false;
    score = 0;
    highScore = 0;

    constructor() {
        super();
        this.loadGameState();
    }

    createEmptyBoard() {
        return Array(4)
            .fill(null)
            .map(() => Array(4).fill(null));
    }

    saveGameState() {
        localStorage.setItem(
            'gameState',
            JSON.stringify({
                board: this.board,
                defeated: this.defeated,
                score: this.score,
                highScore: this.highScore,
            })
        );
    }

    loadGameState() {
        const savedState = localStorage.getItem('gameState');
        if (savedState) {
            const { board, defeated, score, highScore } =
                JSON.parse(savedState);
            this.board = board;
            this.defeated = defeated;
            this.score = score;
            this.highScore = highScore;
        } else {
            this.newGame();
        }
    }

    newGame() {
        this.board = this.createEmptyBoard();
        this.addTile();
        this.addTile();
        this.defeated = false;
        this.score = 0;
        this.saveGameState();
        this.requestUpdate();
    }

    addTile() {
        if (this.defeated) return;
        const emptyTiles = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (!this.board[row][col]) {
                    emptyTiles.push([row, col]);
                }
            }
        }
        if (emptyTiles.length > 0) {
            const [row, col] =
                emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
            this.board[row][col] = Math.random() < 0.9 ? 2 : 4;
        }
        if (emptyTiles.length === 1 && this.gameOver()) {
            this.defeated = true;
        }
        this.saveGameState();
        this.requestUpdate();
    }

    gameOver() {
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (!this.board?.[row]?.[col]) return false;
                if (
                    col < 3 &&
                    this.board[row][col] === this.board[row][col + 1]
                )
                    return false;
                if (
                    row < 3 &&
                    this.board[row][col] === this.board[row + 1][col]
                )
                    return false;
            }
        }
        return true;
    }

    handleDirection(direction: any) {
        const previousState = JSON.stringify(this.board);
        this.handleMove(direction);
        if (JSON.stringify(this.board) !== previousState) this.addTile();
    }

    handleMove(direction: any) {
        const combine = (line: any) => {
            let newLine = line.filter((tile: any) => tile !== null);
            for (let i = 0; i < newLine.length - 1; i++) {
                if (newLine[i] === newLine[i + 1]) {
                    newLine[i] *= 2;
                    this.score += newLine[i];
                    newLine[i + 1] = null;
                }
            }
            newLine = newLine.filter((tile: any) => tile !== null);
            while (newLine.length < 4) {
                newLine.push(null);
            }
            return newLine;
        };

        const move = (board: any, reverse: any) => {
            return board.map((row: any) => {
                if (reverse) {
                    row = row.reverse();
                }
                row = combine(row);
                if (reverse) {
                    row = row.reverse();
                }
                return row;
            });
        };

        let transposed = false;

        if (direction === 'up' || direction === 'down') {
            this.board = this.board[0].map((_: any, colIndex: any) =>
                this.board.map((row: any) => row[colIndex])
            );
            transposed = true;
        }

        if (direction === 'right' || direction === 'down') {
            this.board = move(this.board, true);
        } else {
            this.board = move(this.board, false);
        }

        if (transposed) {
            this.board = this.board[0].map((_: any, colIndex: any) =>
                this.board.map((row: any) => row[colIndex])
            );
        }

        this.highScore = Math.max(this.highScore, this.score);
        this.saveGameState();
    }

    render() {
        return html`
            <div class="scoreboard">
                <div>Score: ${this.score}</div>
                <div>High Score: ${this.highScore}</div>
            </div>
            <div class="game-container">
                ${this.defeated
                    ? html`
                          <div class="defeat-overlay">
                              <div class="defeat-screen">Game Over</div>
                          </div>
                      `
                    : ''}
                ${this.board.map((row: any) =>
                    row.map(
                        (tile: any) => html`
                            <div class="tile" data-value="${tile || 0}">
                                ${tile}
                            </div>
                        `
                    )
                )}
            </div>
            <button
                @click="${() => {
                    this.newGame();
                    this.newGame();
                }}"
            >
                New Game
            </button>
        `;
    }

    keyDownHandler = (event: any) => {
        if (event.key.startsWith('Arrow')) {
            const direction = event.key.toLowerCase().split('arrow')[1];
            this.handleDirection(direction);
        }
    };

    connectedCallback() {
        super.connectedCallback();
        this.gesture = new TinyGesture(this, { velocityThreshold: 5 });
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
                display: block;
            }
            .scoreboard {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 24px;
                font-weight: bold;
            }
            .game-container {
                width: 100%;
                max-width: 500px;
                height: 100%;
                max-height: 500px;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                grid-template-rows: repeat(4, 1fr);
                gap: 10px;
                background-color: #bbada0;
                border-radius: 6px;
                padding: 10px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                margin: auto;
                position: relative;
            }
            .tile {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 36px;
                font-weight: bold;
                border-radius: 6px;
                color: #776e65;
                background-color: #cdc1b4;
                transition:
                    transform 0.2s,
                    background-color 0.2s;
                animation: tileAppear 0.2s;
                aspect-ratio: 1 / 1;
            }

            .tile[data-value='2'] {
                background-color: #eee4da;
            }
            .tile[data-value='4'] {
                background-color: #ede0c8;
            }
            .tile[data-value='8'] {
                background-color: #f2b179;
                color: white;
            }
            .tile[data-value='16'] {
                background-color: #f59563;
                color: white;
            }
            .tile[data-value='32'] {
                background-color: #f67c5f;
                color: white;
            }
            .tile[data-value='64'] {
                background-color: #f65e3b;
                color: white;
            }
            .tile[data-value='128'] {
                background-color: #edcf72;
                color: white;
            }
            .tile[data-value='256'] {
                background-color: #edcc61;
                color: white;
            }
            .tile[data-value='512'] {
                background-color: #edc850;
                color: white;
            }
            .tile[data-value='1024'] {
                background-color: #edc53f;
                color: white;
            }
            .tile[data-value='2048'] {
                background-color: #edc22e;
                color: white;
            }
            .tile[data-value='4096'] {
                background-color: #3c3a32;
                color: white;
            }
            .tile[data-value='8192'] {
                background-color: #3c3a32;
                color: white;
            }
            .defeat-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2;
            }
            .defeat-screen {
                font-size: 48px;
                font-weight: bold;
                color: #f65e3b;
                background: rgba(255, 255, 255, 0.8);
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                text-align: center;
                margin-bottom: 20px;
            }
            @keyframes tileAppear {
                from {
                    transform: scale(0);
                }
                to {
                    transform: scale(1);
                }
            }
        `,
    ];
}

//make gameover an overlay
//Scale to fill a mobile screen
//new game on defeat screen is broken
//simplify logic where possible

//add PWA shortcut
//style like Jot

//make sure game is ending on correct condition
//Fix swipes
