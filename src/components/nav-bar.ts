import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { Router } from '@vaadin/router';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';
import { EtchRoute, routerContext } from '../routes/route-config';

@customElement('nav-bar')
export class NavBar extends LitElement {
    moods = data.moods;
    @consume({ context: routerContext })
    @property({ attribute: false })
    public router?: Router;
    protected firstUpdated(): void {
        window.addEventListener('vaadin-router-location-changed', () => {
            this.currentPath = this.router?.location.pathname;
        });
    }
    @state()
    private currentPath = this.router?.location.pathname;
    isRouteSelected(path: string) {
        if (this.currentPath)
            return (
                this.currentPath === path ||
                (this.currentPath === '/' && path === '/entries')
            );
    }

    render() {
        return html`
            <footer>
                ${(this.router?.getRoutes() || [])
                    .filter((route: EtchRoute) => route.options?.menuItem)
                    .map((route: EtchRoute) => {
                        return html`<a
                            class=${'menu-bar-item ' +
                            (this.isRouteSelected(route.path)
                                ? 'menu-bar-item-active'
                                : 'menu-bar-item-inactive')}
                            href="${route.path}"
                        >
                            <feather-icon
                                name=${route.options?.iconName || 'smile'}
                                .options="${{
                                    height: '1.5rem',
                                    width: '1.5rem',
                                }}"
                            >
                            </feather-icon>
                            <span class="menu-bar-item-text">
                                ${this.isRouteSelected(route.path)
                                    ? route.name
                                    : nothing}</span
                            >
                        </a>`;
                    })}
            </footer>
        `;
    }
    static styles = [
        base,
        css`
            footer {
                text-align: center;
                width: 100%;
                position: fixed;
                bottom: -1px;
                height: 4rem;
                background-color: var(--card-background-color);
                box-shadow: var(--card-box-shadow);
                line-height: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                user-select: none;
                gap: 0.5rem;
                z-index: 100;
            }

            .menu-bar-item {
                transition: height 0.2s;
                cursor: pointer;
                width: 5rem;
                height: 3rem;
                display: inline-flex;
                flex-flow: column;
                align-items: center;
                font-size: 12px;
                font-weight: bold;
            }
            .menu-bar-item-inactive {
                height: 1.5rem;
                opacity: 0.6;
            }
            svg {
                --color: var(--contrast);
                height: 1.5rem;
                width: 1.5rem;
            }
            .menu-bar-item-active feather-icon {
                transition: all 0.2s;
                background: var(--secondary);
                color: var(--primary-inverse);
                border-radius: 20px;
                padding: 4px 20px;
            }
            .menu-bar-item-text {
                line-height: 1.25rem;
            }
            a:focus,
            a:active {
                background-color: transparent;
            }
        `,
    ];
}
