import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import { Activity } from '../interfaces/activity.interface';
import { ActivityDetail } from '../interfaces/entry.interface';
import { dispatchEvent, Events, Helpers } from '../utils/Helpers';
import './activity-detail.component';

@customElement('activity-component')
export class ActivityComponent extends LitElement {
    @property()
    public detail?: ActivityDetail;
    @property()
    public showName: boolean = false;
    @property()
    public activity?: Activity;
    protected firstUpdated(): void {
        const gesture = new TinyGesture(this, {});
        gesture.on('doubletap', () => {
            dispatchEvent(this, Events.activityDoubleClick, {
                id: this.activity?.id,
            });
        });

        gesture.on('longpress', () => {
            dispatchEvent(this, Events.activityLongClick, {
                id: this.activity?.id,
            });
        });
    }
    render() {
        if (!this.activity) return nothing;
        return html`<span
            class="activity-container"
            @click=${(e: Event) => {
                dispatchEvent(this, Events.activityClick, {
                    event: e,
                    id: this.activity?.id,
                });
            }}
        >
            <span title=${this.activity.name}>
                <span title.bind="activity.name" class="emoji">
                    ${this.activity.emoji}
                    ${(Helpers.isNumeric(this.detail) && this.detail != 1) ||
                    (Array.isArray(this.detail) && this.detail.length > 1)
                        ? html`<span class="activity-detail-number"
                              >${Array.isArray(this.detail)
                                  ? this.detail.length
                                  : this.detail}</span
                          >`
                        : nothing}

                    <slot></slot>
                </span>
                ${this.showName
                    ? html`<div class="activity-name">
                          ${this.activity.name}
                      </div>`
                    : nothing}
            </span>
            ${Array.isArray(this.detail) && this.detail.length > 0
                ? html`<span
                      class="activity-detail-list ${!this.isWide()
                          ? 'activity-narrow'
                          : ''}"
                  >
                      ${(this.detail as string[]).map(
                          (textItem) =>
                              html`<activity-detail-component
                                  @click=${(e: Event) => {
                                      dispatchEvent(
                                          this,
                                          Events.activityDetailClick,
                                          {
                                              event: e,
                                              detail: textItem,
                                              id: this.activity?.id,
                                          }
                                      );
                                  }}
                                  >${textItem}</activity-detail-component
                              >`
                      )}
                  </span>`
                : nothing}
        </span>`;
    }
    isWide(): boolean {
        return (
            Array.isArray(this.detail) &&
            (this.detail.length > 3 ||
                this.detail.filter((val) => val.length >= 50).length > 0)
        );
    }
    static styles = [
        base,
        css`
            :host {
                display: inline-flex;
                border: 1px solid transparent;
                margin: 2px;
                padding: 4px 6px;
            }
            .activity-container {
                display: inline-flex;
                text-align: center;
                align-items: flex-start;
                user-select: none;
            }
            .emoji {
                display: inline-block;
                position: relative;
                font-size: 1.875rem;
                line-height: 2.25rem;
            }
            .activity-detail-number {
                display: inline-flex;
                position: absolute;
                left: -0.1rem;
                bottom: -0.375rem;
                padding-top: 0;
                padding-bottom: 0;
                padding-left: 0.375rem;
                padding-right: 0.375rem;
                color: var(--background-color);
                background-color: var(--color);
                font-size: 0.75rem;
                line-height: 1rem;
                justify-content: center;
                align-items: center;
                border-radius: 9999px;
            }
            .activity-detail-list {
                display: flex;
                gap: 2px;
                text-align: left;
                flex-wrap: wrap;
                justify-content: start;
                align-self: center;
                user-select: text;
            }
            .activity-narrow {
                flex-flow: column;
            }
            .activity-name {
                font-size: 0.875rem;
                line-height: 1.25rem;
                overflow-wrap: break-word;
            }
        `,
    ];
}
