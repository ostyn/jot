export type QueueStatus = 'active' | 'done';
export type FetchState = 'pending' | 'ready' | 'failed';
export type MetadataSource = 'iframely' | 'document' | 'none';

export interface ReadingItem {
    id: string;
    url: string;
    normalizedUrl: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    httpStatus?: number;
    fetchState: FetchState;
    metadataSource: MetadataSource;
    metadataUpdatedAt?: string;
    queueStatus: QueueStatus;
    openedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}
