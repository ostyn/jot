import { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/action-sheets/mood-edit.sheet';
import { MoodEditSheet } from '../components/action-sheets/mood-edit.sheet';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';
import { AbstractSheetRoute } from './AbstractSheetRoute';

@customElement('mood-edit-route')
export class MoodEditRoute extends AbstractSheetRoute {
    @state() moodData: Mood = {} as Mood;

    async onBeforeEnter(location: any) {
        await super.onBeforeEnter(location);
        if (location.params?.id) {
            this.moodData = moods.getMood(location.params.id) || ({} as Mood);
        }
    }

    renderSheetContent(): TemplateResult {
        return MoodEditSheet.getActionSheet(this.moodData, () =>
            this.closePage()
        );
    }
}
