export interface Mood {
    emoji: string;
    created?: string;
    id: string;
    name: string;
    rating: '1' | '2' | '3' | '4' | '5';
}
