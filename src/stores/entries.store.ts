import { action, makeObservable, observable, runInAction } from 'mobx';
import { entryDao } from '../dao/EntryDao';
import { Entry } from '../interfaces/entry.interface';

const entriesData: Entry[] = await entryDao.getItems();
class EntriesStore {
    @observable
    public all: Entry[] = entriesData;
    @action.bound
    public async reset() {
        this.all = [];
        entryDao.reset();
    }
    public getEntry(id: string): Promise<Entry | undefined> {
        return entryDao.getItem(id);
    }
    @action.bound
    async upsertEntry(userEntry: Partial<Entry>) {
        await entryDao.saveItem(userEntry);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    @action.bound
    async bulkImport(entries: Entry[]) {
        await entryDao.saveItems(entries);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    @action.bound
    async insertEntry(userEntry: any) {
        await entryDao.saveItem(userEntry);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    @action.bound
    public async removeEntry(id?: string) {
        await entryDao.deleteItem(id);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    constructor() {
        makeObservable(this);
    }
}
export const entries = new EntriesStore();
