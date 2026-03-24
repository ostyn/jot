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

class ReadingStore {
    @observable
    all: ReadingItem[] = readingData;

    private enrichQueue = new Set<string>();
    private autoRetryQueue = new Set<string>();

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
        const urls = extractUrls(text);
        const now = new Date().toISOString();
        const existing = new Set(this.normalizedUrlSet);
        const itemsToSave: ReadingItem[] = [];

        for (const urlText of urls) {
            try {
                const normalizedUrl = normalizeUrl(urlText);
                if (existing.has(normalizedUrl)) continue;
                existing.add(normalizedUrl);
                itemsToSave.push({
                    id: crypto.randomUUID(),
                    url: urlText.trim(),
                    normalizedUrl,
                    fetchState: 'pending',
                    metadataSource: 'none',
                    queueStatus: 'active',
                    createdAt: now,
                    updatedAt: now,
                });
            } catch (_error) {
                continue;
            }
        }

        await readingItemDao.bulkPut(itemsToSave);
        await this.refresh();

        itemsToSave.forEach((item) => {
            void this.enrichItem(item.id);
        });

        return itemsToSave;
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
}

export const reading = new ReadingStore();
