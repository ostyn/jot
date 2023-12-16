export interface TrackerDao {
    getItem(id: string): Promise<any>;
    getItems(): Promise<any>;
    getItemsFromQuery(query: any): Promise<any>;
    saveItem(passedEntry: any): Promise<any>;
    deleteItem(id: string): Promise<void>;
    beforeSaveFixup(item: any): any;
    afterLoadFixup(item: any): any;
    sortItems(items: any): any[];
}
