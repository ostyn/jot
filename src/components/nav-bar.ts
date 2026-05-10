import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { consume } from '@lit/context';
import { MobxLitElement } from '@adobe/lit-mobx';
import { Router } from '@vaadin/router';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import { JotRoute, routerContext } from '../routes/route-config';
import { reminders } from '../stores/reminders.store';
import { settings } from '../stores/settings.store';

// Each entry must read an observable so MobxLitElement reacts to changes.
const NAV_BADGES: Record<string, () => number> = {
    activities: () => reminders.dueCount,
};

@customElement('nav-bar')
export class NavBar extends MobxLitElement {
    @consume({ context: routerContext })
    @property({ attribute: false })
    public router?: Router;
    protected firstUpdated(): void {
        window.addEventListener('vaadin-router-location-changed', () => {
            this.currentPath = this.router?.location.pathname;
        });
        const gesture = new TinyGesture(this, {});

        gesture.on('longpress', () => {
            settings.setShowArchived(!settings.showArchived);
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
                <span class="footer-content">
                    ${(this.router?.getRoutes() || [])
                        .filter((route: JotRoute) => route.options?.menuItem)
                        .map((route: JotRoute) => {
                            const badge = route.name
                                ? (NAV_BADGES[route.name]?.() ?? 0)
                                : 0;
                            return html`<a
                                class="item-wrapper"
                                href="${route.path}"
                                aria-label=${ifDefined(route.name)}
                                ><span
                                    class=${'menu-bar-item ' +
                                    (this.isRouteSelected(route.path)
                                        ? 'menu-bar-item-active'
                                        : 'menu-bar-item-inactive')}
                                >
                                    <span class="icon-with-badge">
                                        <jot-icon
                                            name=${route.options?.iconName ||
                                            'Smile'}
                                            size="large"
                                        >
                                        </jot-icon>
                                        ${badge > 0
                                            ? html`<span class="nav-badge"
                                                  >${badge}</span
                                              >`
                                            : nothing}
                                    </span>
                                    <span class="menu-bar-item-text">
                                        ${this.isRouteSelected(route.path)
                                            ? route.name
                                            : nothing}</span
                                    >
                                </span></a
                            >`;
                        })}
                </span>
            </footer>
        `;
    }
    static styles = [
        base,
        css`
            footer {
                width: 100%;
                position: fixed;
                bottom: -1px;
                background-color: var(--pico-card-background-color);
                box-shadow: var(--pico-card-box-shadow);
                z-index: 100;
                overflow: hidden;
            }

            @supports (-webkit-hyphens: none) {
                footer {
                    padding-bottom: 16px;
                }
            }

            .footer-content {
                display: flex;
                justify-content: center;
                align-items: center;
                user-select: none;
                overflow-x: auto;
                scrollbar-width: none;
            }
            .item-wrapper {
                height: 64px;
                display: flex;
                align-items: center;
            }

            .menu-bar-item {
                transition: height 0.2s;
                cursor: pointer;
                width: 5rem;
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
                --color: var(--pico-contrast);
                height: 1.5rem;
                width: 1.5rem;
            }
            .menu-bar-item-active jot-icon {
                line-height: 0px;
                transition: all 0.2s;
                background: var(--pico-secondary);
                color: var(--pico-primary-inverse);
                border-radius: 20px;
                padding: 4px 20px;
            }
            a:focus,
            a:active {
                background-color: transparent;
            }
            .icon-with-badge {
                position: relative;
                display: inline-flex;
            }
            .nav-badge {
                position: absolute;
                top: 0;
                right: -0.4rem;
                min-width: 0.875rem;
                height: 0.875rem;
                padding: 0 0.25rem;
                background-color: var(--pico-primary);
                color: var(--pico-primary-inverse);
                border-radius: 9999px;
                font-size: 0.5625rem;
                line-height: 0.875rem;
                text-align: center;
                font-weight: bold;
            }
        `,
    ];
}
