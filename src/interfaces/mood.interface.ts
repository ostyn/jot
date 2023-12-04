export interface Mood {
    emoji: string;
    created: Date;
    updated: Date;
    id: string;
    name: string;
    rating: '1' | '2' | '3' | '4' | '5';
}
