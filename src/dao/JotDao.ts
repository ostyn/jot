export interface JotDao {
    getItem(id: string): Promise<any>;
    getItems(): Promise<any>;
    saveItem(passedEntry: any): Promise<any>;
    deleteItem(id: string): Promise<void>;
    sortItems(items: any): any[];
}
