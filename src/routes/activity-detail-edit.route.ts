import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { RouterLocation } from '@vaadin/router';
import { ActivityDetailEditSheet } from '../components/action-sheets/activity-detail-edit.sheet.ts';
import { ActivityDetail } from '../interfaces/entry.interface.ts';
import { AbstractSheetRoute } from './AbstractSheetRoute.ts';
import { store } from './entry-edit.route.ts';

@customElement('activity-edit-detail-route')
export class ActivityDetailEditRoute extends AbstractSheetRoute {
    activityId?: string;
    @state() activityDetail?: ActivityDetail;
    isLoaded = false;

    async onAfterEnter(location: RouterLocation) {
        this.activityId = location.params.activityId as string;

        // Wait for store to be fully initialized (including draft decision if applicable)
        await store?.storeReady;
        this.activityDetail = store?.getActivityDetail(this.activityId);
        this.isLoaded = true;
    }

    private handleActivityDetailUpdate(updatedDetail: ActivityDetail) {
        console.log(this.activityId, updatedDetail);
        if (!this.activityId) return;
        if (
            updatedDetail === undefined ||
            updatedDetail === null ||
            (Array.isArray(updatedDetail) && updatedDetail.length === 0)
        ) {
            store?.clearActivityDetail(this.activityId);
        } else {
            store?.setActivityDetail(this.activityId, updatedDetail);
        }
    }

    renderSheetContent() {
        return this.isLoaded
            ? html`${ActivityDetailEditSheet.getActionSheet(
                  {
                      id: this.activityId,
                      detail: this.activityDetail,
                      close: () => this.closePage(),
                  },
                  (updatedDetail: ActivityDetail) =>
                      this.handleActivityDetailUpdate(updatedDetail)
              )}`
            : html`${nothing}`;
    }
}
