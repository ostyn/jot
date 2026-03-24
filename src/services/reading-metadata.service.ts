import {
    FetchState,
    MetadataSource,
} from '../interfaces/reading-item.interface';

const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
const iframelyApiKey = import.meta.env.VITE_IFRAMELY_API_KEY;

export type MetadataResult = {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    httpStatus?: number;
    fetchState: FetchState;
    metadataSource: MetadataSource;
};

type IframelyPayload = {
    description?: string;
    links?: {
        image?: Array<{ href?: string }>;
        thumbnail?: Array<{ href?: string }>;
    };
    meta?: {
        description?: string;
        site?: string;
        title?: string;
    };
    http?: {
        status_code?: number;
    };
    provider_name?: string;
    site?: string;
    status?: number;
    thumbnail_url?: string;
    title?: string;
};

export function normalizeUrl(rawUrl: string): string {
    const url = new URL(rawUrl.trim());
    url.hash = '';
    if (
        (url.protocol === 'https:' && url.port === '443') ||
        (url.protocol === 'http:' && url.port === '80')
    ) {
        url.port = '';
    }
    if (url.pathname !== '/') {
        url.pathname = url.pathname.replace(/\/+$/, '');
    }
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
}

export function extractUrls(text: string): string[] {
    const matches = text.match(urlPattern) || [];
    return matches.map((match) => match.replace(/[),.;]+$/, ''));
}

function metaContent(doc: Document, selectors: string[]): string | undefined {
    for (const selector of selectors) {
        const value = doc.querySelector(selector)?.getAttribute('content')?.trim();
        if (value) return value;
    }
    return undefined;
}

async function fetchMetadataWithIframely(
    url: string
): Promise<MetadataResult | undefined> {
    if (!iframelyApiKey) return undefined;

    try {
        const response = await fetch(
            `https://iframe.ly/api/iframely?url=${encodeURIComponent(url)}&key=${iframelyApiKey}`
        );
        if (!response.ok) return undefined;
        const payload = (await response.json()) as IframelyPayload;
        if (!payload) return undefined;

        const image =
            payload.links?.thumbnail?.[0]?.href ||
            payload.links?.image?.[0]?.href ||
            payload.thumbnail_url ||
            undefined;
        const siteName =
            payload.meta?.site ||
            payload.site ||
            payload.provider_name ||
            undefined;
        const description =
            payload.meta?.description || payload.description || undefined;
        const title = payload.meta?.title || payload.title || undefined;
        const statusCode =
            typeof payload.status === 'number'
                ? payload.status
                : typeof payload.http?.status_code === 'number'
                  ? payload.http.status_code
                  : undefined;

        if (!title && !description && !image && !siteName && !statusCode) {
            return undefined;
        }

        return {
            title,
            description,
            image,
            siteName,
            httpStatus: statusCode,
            fetchState: 'ready',
            metadataSource: 'iframely',
        };
    } catch (_error) {
        return undefined;
    }
}

async function fetchMetadataFromDocument(url: string): Promise<MetadataResult> {
    try {
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title =
            metaContent(doc, [
                'meta[property="og:title"]',
                'meta[name="twitter:title"]',
            ]) || doc.querySelector('title')?.textContent?.trim();

        return {
            title,
            description: metaContent(doc, [
                'meta[property="og:description"]',
                'meta[name="twitter:description"]',
                'meta[name="description"]',
            ]),
            image: metaContent(doc, [
                'meta[property="og:image"]',
                'meta[name="twitter:image"]',
            ]),
            siteName: metaContent(doc, ['meta[property="og:site_name"]']),
            httpStatus: response.status,
            fetchState: 'ready',
            metadataSource: 'document',
        };
    } catch (_error) {
        return {
            fetchState: 'failed',
            metadataSource: 'none',
        };
    }
}

export async function fetchMetadata(url: string): Promise<MetadataResult> {
    const iframelyResult = await fetchMetadataWithIframely(url);
    if (iframelyResult) return iframelyResult;
    return fetchMetadataFromDocument(url);
}
