import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import {
    QueueStatus,
    ReadingItem,
} from '../interfaces/reading-item.interface';
import { readingItemDao } from '../dao/ReadingItemDao';
import {
    extractUrls,
    fetchMetadata,
    normalizeUrl,
} from '../services/reading-metadata.service';

const readingData: ReadingItem[] = await readingItemDao.getItems();

export type ShareImportResult = {
    importedActiveItemIds: string[];
    existingActiveItemIds: string[];
    existingDoneItemIds: string[];
};

class ReadingStore {
    @observable
    all: ReadingItem[] = readingData;

    private enrichQueue = new Set<string>();
    private autoRetryQueue = new Set<string>();
    private importQueue: Promise<void> = Promise.resolve();

    constructor() {
        makeObservable(this);
        this.all
            .filter((item) => item.fetchState === 'pending')
            .forEach((item) => {
                void this.enrichItem(item.id);
            });
    }

    @computed
    get active() {
        return this.all.filter((item) => item.queueStatus === 'active');
    }

    @computed
    get done() {
        return this.all.filter((item) => item.queueStatus === 'done');
    }

    @computed
    get normalizedUrlSet() {
        return new Set(this.all.map((item) => item.normalizedUrl));
    }

    @action.bound
    async refresh() {
        const items = await readingItemDao.getItems();
        runInAction(() => {
            this.all = items;
        });
    }

    @action.bound
    async importFromText(text: string): Promise<ReadingItem[]> {
        const result = await this.importUrls(extractUrls(text));
        return result.importedItems;
    }

    @action.bound
    async importSharedPayload(payload: {
        title?: string;
        text?: string;
        url?: string;
    }): Promise<ShareImportResult> {
        const parts = [payload.url, payload.text, payload.title]
            .filter((value): value is string => Boolean(value?.trim()))
            .join('\n');
        const result = await this.importUrls(extractUrls(parts));
        return {
            importedActiveItemIds: result.importedItems.map((item) => item.id),
            existingActiveItemIds: result.existingActiveItems.map(
                (item) => item.id
            ),
            existingDoneItemIds: result.existingDoneItems.map((item) => item.id),
        };
    }

    @action.bound
    async markDone(id: string) {
        const current = this.all.find((item) => item.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        await readingItemDao.saveItem({
            ...current,
            queueStatus: 'done' as QueueStatus,
            completedAt: now,
            updatedAt: now,
        });
        await this.refresh();
    }

    @action.bound
    async deleteItem(id: string) {
        await readingItemDao.deleteItem(id);
        await this.refresh();
    }

    @action.bound
    async requeue(id: string) {
        const current = this.all.find((item) => item.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        await readingItemDao.saveItem({
            ...current,
            queueStatus: 'active',
            completedAt: undefined,
            updatedAt: now,
        });
        await this.refresh();
    }

    @action.bound
    async restoreItem(item: ReadingItem) {
        await readingItemDao.saveItem(item);
        await this.refresh();
    }

    @action.bound
    async markOpened(id: string) {
        const current = this.all.find((item) => item.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        await readingItemDao.saveItem({
            ...current,
            openedAt: now,
            updatedAt: now,
        });
        await this.refresh();
    }

    @action.bound
    async retryMetadata(id: string) {
        const current = this.all.find((item) => item.id === id);
        if (!current) return;
        await readingItemDao.saveItem({
            ...current,
            fetchState: 'pending',
            metadataSource: 'none',
            updatedAt: new Date().toISOString(),
        });
        await this.refresh();
        await this.enrichItem(id);
    }

    @action.bound
    async ensureMetadata(id: string) {
        const current = this.all.find((item) => item.id === id);
        if (!current) return;

        if (current.fetchState === 'pending') {
            await this.enrichItem(id);
            return;
        }

        if (
            current.fetchState === 'failed' &&
            current.metadataSource === 'none' &&
            !this.autoRetryQueue.has(id)
        ) {
            this.autoRetryQueue.add(id);
            await this.retryMetadata(id);
        }
    }

    async enrichItem(id: string) {
        if (this.enrichQueue.has(id)) return;
        this.enrichQueue.add(id);
        try {
            const current = this.all.find((item) => item.id === id);
            if (!current) return;
            if (current.fetchState !== 'pending') return;
            const metadata = await fetchMetadata(current.url);
            const updatedAt = new Date().toISOString();
            await readingItemDao.saveItem({
                ...current,
                ...metadata,
                metadataUpdatedAt: updatedAt,
                updatedAt,
            });
            await this.refresh();
        } finally {
            this.enrichQueue.delete(id);
        }
    }

    private async importUrls(urls: string[]): Promise<{
        importedItems: ReadingItem[];
        existingActiveItems: ReadingItem[];
        existingDoneItems: ReadingItem[];
    }> {
        let importedItems: ReadingItem[] = [];
        let existingActiveItems: ReadingItem[] = [];
        let existingDoneItems: ReadingItem[] = [];

        this.importQueue = this.importQueue.then(async () => {
            await this.refresh();

            const now = new Date().toISOString();
            const existingByNormalizedUrl = new Map(
                this.all.map((item) => [item.normalizedUrl, item] as const)
            );
            const seenNormalizedUrls = new Set<string>();
            const itemsToSave: ReadingItem[] = [];
            existingActiveItems = [];
            existingDoneItems = [];

            for (const urlText of urls) {
                try {
                    const normalizedUrl = normalizeUrl(urlText);
                    if (seenNormalizedUrls.has(normalizedUrl)) continue;
                    seenNormalizedUrls.add(normalizedUrl);

                    const existingItem = existingByNormalizedUrl.get(normalizedUrl);
                    if (existingItem) {
                        if (existingItem.queueStatus === 'active') {
                            existingActiveItems.push(existingItem);
                        } else {
                            existingDoneItems.push(existingItem);
                        }
                        continue;
                    }

                    const newItem: ReadingItem = {
                        id: crypto.randomUUID(),
                        url: urlText.trim(),
                        normalizedUrl,
                        fetchState: 'pending',
                        metadataSource: 'none',
                        queueStatus: 'active',
                        createdAt: now,
                        updatedAt: now,
                    };
                    itemsToSave.push(newItem);
                    existingByNormalizedUrl.set(normalizedUrl, newItem);
                } catch (_error) {
                    continue;
                }
            }

            await readingItemDao.bulkPut(itemsToSave);
            await this.refresh();
            importedItems = itemsToSave;

            itemsToSave.forEach((item) => {
                void this.enrichItem(item.id);
            });
        });
        await this.importQueue;

        return {
            importedItems,
            existingActiveItems,
            existingDoneItems,
        };
    }
}

export const reading = new ReadingStore();
