import { EditTools } from '../interfaces/entry.interface';
import { db } from '../services/Dexie';
import { EtchDao } from './EtchDao';

export class DexieDao implements EtchDao {
    name: string;
    notify: any = () => {};

    constructor(name: string) {
        this.name = name;
    }
    setupCacheAndUpdateListener(notify: any): void {
        this.notify = notify;
        notify();
    }
    reset() {
        db.table(this.name).clear();
    }
    async getItem(id: string): Promise<any> {
        return await db.table(this.name).get(id);
    }
    async getItems(): Promise<any> {
        let items = await db.table(this.name).toArray();
        return this.sortItems(items);
    }
    saveItem(passedEntry: any): Promise<any> {
        if (passedEntry.id === undefined || !passedEntry.id) {
            passedEntry.id = crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random();
        }
        passedEntry.updated = new Date();
        if (!passedEntry.created) {
            passedEntry.created = passedEntry.updated;
        }
        passedEntry.lastUpdatedBy = EditTools.WEB;
        if (!passedEntry.createdBy) {
            passedEntry.createdBy = EditTools.WEB;
        }
        const newLocal = db.table(this.name).put(passedEntry);
        newLocal.then(() => {
            this.notify();
        });
        return newLocal;
    }
    async saveItems(
        passedItems: any[],
        importTool = EditTools.DAYLIO_IMPORT
    ): Promise<any> {
        const itemsToSave: any[] = [];
        passedItems.forEach((item) => {
            let newItem = { ...item };
            newItem.id ||= crypto.randomUUID();
            newItem.created ||= new Date();
            newItem.updated ||= newItem.created;

            item.lastUpdatedBy = importTool;
            item.createdBy ||= importTool;
            itemsToSave.push(newItem);
        });

        await db.table(this.name).bulkAdd(itemsToSave);
        this.notify();
    }
    async deleteItem(id: any): Promise<void> {
        await db.table(this.name).delete(id);
        this.notify();
    }
    sortItems(items: any[]): any[] {
        return items;
    }
}
