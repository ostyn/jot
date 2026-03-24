import { db } from '../services/Dexie';
import { ReadingItem } from '../interfaces/reading-item.interface';

export class ReadingItemDao {
    private tableName = 'readingItems';

    async getItems(): Promise<ReadingItem[]> {
        const items = (await db.table(this.tableName).toArray()) as ReadingItem[];
        return items.sort((a, b) => {
            if (a.queueStatus !== b.queueStatus) {
                return a.queueStatus === 'active' ? -1 : 1;
            }
            return b.updatedAt.localeCompare(a.updatedAt);
        });
    }

    async saveItem(item: ReadingItem): Promise<string> {
        await db.table(this.tableName).put(item);
        return item.id;
    }

    async bulkPut(items: ReadingItem[]): Promise<void> {
        if (!items.length) return;
        await db.table(this.tableName).bulkPut(items);
    }

    async deleteItem(id: string): Promise<void> {
        await db.table(this.tableName).delete(id);
    }

    async reset(): Promise<void> {
        await db.table(this.tableName).clear();
    }
}

export const readingItemDao = new ReadingItemDao();
