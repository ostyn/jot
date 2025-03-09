import { EditTools } from '../interfaces/entry.interface';
import { db } from '../services/Dexie';
import { JotDao } from './JotDao';

export class DexieDao implements JotDao {
    name: string;

    constructor(name: string) {
        this.name = name;
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
        if (!passedEntry.editLog) {
            this.addUpdateInfo(passedEntry);
        }
        const newLocal = db.table(this.name).put(passedEntry);
        return newLocal;
    }
    async saveItems(passedItems: any[], importTool: EditTools): Promise<any> {
        const itemsToSave: any[] = [];
        passedItems.forEach((item) => {
            let newItem = { ...item };
            newItem.id ||= crypto.randomUUID();
            if (!item.editLog) {
                this.addUpdateInfo(newItem);
            } else {
                item.editLog.push({
                    date: new Date(),
                    tool: importTool,
                });
            }
            itemsToSave.push(newItem);
        });

        await db.table(this.name).bulkAdd(itemsToSave);
    }
    async deleteItem(id: any): Promise<void> {
        await db.table(this.name).delete(id);
    }
    sortItems(items: any[]): any[] {
        return items;
    }
    private addUpdateInfo(passedEntry: any) {
        passedEntry.updated = new Date();
        if (!passedEntry.created) {
            passedEntry.created = passedEntry.updated;
        }
    }
}
