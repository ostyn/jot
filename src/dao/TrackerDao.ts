export interface TrackerDao {
    getItem(id: string): Promise<any>;
    getItems(): Promise<any>;
    getItemsFromQuery(query): Promise<any>;
    saveItem(passedEntry): Promise<any>;
    deleteItem(id): Promise<void>;
    beforeSaveFixup(item): any;
    afterLoadFixup(item): any;
    sortItems(items): any[];
}
