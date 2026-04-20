import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const defaultOutputDir = path.join(projectRoot, 'public/generated');
const envFilePath = path.join(projectRoot, '.env');

const defaultConfig = {
    apiBaseUrl: 'https://api.themoviedb.org/3',
    discoverPath: '/discover/movie',
    outputDir: defaultOutputDir,
    filteredIdsOutputPath: path.join(
        defaultOutputDir,
        'filtered_movie_ids.json'
    ),
    manifestOutputPath: path.join(
        defaultOutputDir,
        'movie_pipeline_manifest.json'
    ),
    startDate: '1900-01-01',
    endDate: new Date().toISOString().slice(0, 10),
    region: 'US',
    sortBy: 'primary_release_date.asc',
    includeAdult: false,
    includeVideo: false,
    minVoteCount: 50,
    minRuntime: 60,
    excludedGenreIds: [10770],
    withReleaseType: '2|3|4',
    language: 'en-US',
    concurrency: 6,
    retryCount: 4,
    retryBaseDelayMs: 1000,
};

function isMainModule(metaUrl) {
    return (
        process.argv[1] != null &&
        path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
    );
}

function toBoolean(value, fallbackValue) {
    if (value == null || value === '') return fallbackValue;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallbackValue;
}

function toPositiveInteger(value, fallbackValue) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function toNumberList(value, fallbackValue = []) {
    if (value == null || value === '') return [...fallbackValue];
    return String(value)
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((part) => Number.isFinite(part));
}

function stripInlineComment(value) {
    let quote = null;

    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        const previous = index > 0 ? value[index - 1] : '';

        if ((character === '"' || character === "'") && previous !== '\\') {
            quote =
                quote === character ? null : quote == null ? character : quote;
            continue;
        }

        if (character === '#' && quote == null) {
            return value.slice(0, index).trimEnd();
        }
    }

    return value.trimEnd();
}

function unquoteEnvValue(value) {
    if (value.length < 2) return value;
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
        return value
            .slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
    }
    return value;
}

async function loadDotEnvFile(filePath, targetEnv = process.env) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const lines = raw.split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const match = line.match(
                /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/
            );
            if (!match) continue;

            const [, key, rawValue = ''] = match;
            if (targetEnv[key] != null && targetEnv[key] !== '') continue;

            targetEnv[key] = unquoteEnvValue(
                stripInlineComment(rawValue).trim()
            );
        }
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ENOENT'
        ) {
            return false;
        }
        throw error;
    }

    return true;
}

function parseArgs(argv) {
    const options = {};

    for (const argument of argv) {
        if (!argument.startsWith('--')) continue;

        const trimmed = argument.slice(2);
        if (!trimmed) continue;

        const [key, ...rest] = trimmed.split('=');
        options[key.trim()] = rest.length > 0 ? rest.join('=').trim() : 'true';
    }

    return options;
}

function daysBetween(startDate, endDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.round(
        (Date.parse(endDate) - Date.parse(startDate)) / millisecondsPerDay
    );
}

function addDays(dateString, days) {
    const nextDate = new Date(`${dateString}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate.toISOString().slice(0, 10);
}

function splitWindow(window) {
    const totalDays = daysBetween(window.startDate, window.endDate);
    if (totalDays <= 0) return null;

    const leftSpan = Math.floor(totalDays / 2);
    const midDate = addDays(window.startDate, leftSpan);

    if (midDate <= window.startDate || midDate > window.endDate) return null;

    return [
        {
            startDate: window.startDate,
            endDate: addDays(midDate, -1),
        },
        {
            startDate: midDate,
            endDate: window.endDate,
        },
    ];
}

function buildYearWindows(startDate, endDate) {
    const startYear = Number.parseInt(startDate.slice(0, 4), 10);
    const endYear = Number.parseInt(endDate.slice(0, 4), 10);
    const windows = [];

    for (let year = startYear; year <= endYear; year += 1) {
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        windows.push({
            startDate: year === startYear ? startDate : yearStart,
            endDate: year === endYear ? endDate : yearEnd,
        });
    }

    return windows;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMilliseconds(headerValue) {
    if (!headerValue) return null;

    const seconds = Number.parseInt(headerValue, 10);
    if (Number.isFinite(seconds)) return seconds * 1000;

    const dateValue = Date.parse(headerValue);
    return Number.isFinite(dateValue)
        ? Math.max(0, dateValue - Date.now())
        : null;
}

function getHelpText() {
    return [
        'TMDB single-stage discover movie sync',
        '',
        'Usage:',
        '  node scripts/generate-movie-ids.mjs',
        '',
        'Selected flags:',
        '  --start-date=1950-01-01',
        '  --end-date=2026-03-31',
        '  --region=US',
        '  --min-vote-count=50',
        '  --min-runtime=60',
        '  --excluded-genre-ids=10770',
        '  --with-release-type=2|3|4',
        '  --concurrency=6',
        '  --retry-count=4',
        '',
        'Important env vars:',
        '  TMDB_API_KEY or VITE_TMDB_API_KEY',
        '  TMDB_DISCOVER_START_DATE',
        '  TMDB_DISCOVER_END_DATE',
        '  TMDB_DISCOVER_REGION',
        '  TMDB_DISCOVER_MIN_VOTE_COUNT',
        '  TMDB_DISCOVER_MIN_RUNTIME',
        '  TMDB_DISCOVER_EXCLUDED_GENRE_IDS',
        '  TMDB_DISCOVER_WITH_RELEASE_TYPE',
        '  TMDB_DISCOVER_CONCURRENCY',
    ].join('\n');
}

function createConfig(argv = process.argv.slice(2), env = process.env) {
    const args = parseArgs(argv);
    const outputDir = path.resolve(
        projectRoot,
        args['output-dir'] ||
            env.TMDB_DISCOVER_OUTPUT_DIR ||
            defaultConfig.outputDir
    );

    return {
        ...defaultConfig,
        outputDir,
        filteredIdsOutputPath: path.join(outputDir, 'filtered_movie_ids.json'),
        manifestOutputPath: path.join(
            outputDir,
            'movie_pipeline_manifest.json'
        ),
        tmdbApiKey: env.TMDB_API_KEY || env.VITE_TMDB_API_KEY || '',
        startDate:
            args['start-date'] ||
            env.TMDB_DISCOVER_START_DATE ||
            defaultConfig.startDate,
        endDate:
            args['end-date'] ||
            env.TMDB_DISCOVER_END_DATE ||
            defaultConfig.endDate,
        region: args.region || env.TMDB_DISCOVER_REGION || defaultConfig.region,
        includeAdult: toBoolean(
            args['include-adult'] || env.TMDB_DISCOVER_INCLUDE_ADULT,
            defaultConfig.includeAdult
        ),
        includeVideo: toBoolean(
            args['include-video'] || env.TMDB_DISCOVER_INCLUDE_VIDEO,
            defaultConfig.includeVideo
        ),
        minVoteCount: toPositiveInteger(
            args['min-vote-count'] || env.TMDB_DISCOVER_MIN_VOTE_COUNT,
            defaultConfig.minVoteCount
        ),
        minRuntime: toPositiveInteger(
            args['min-runtime'] || env.TMDB_DISCOVER_MIN_RUNTIME,
            defaultConfig.minRuntime
        ),
        excludedGenreIds: toNumberList(
            args['excluded-genre-ids'] || env.TMDB_DISCOVER_EXCLUDED_GENRE_IDS,
            defaultConfig.excludedGenreIds
        ),
        withReleaseType:
            args['with-release-type'] ||
            env.TMDB_DISCOVER_WITH_RELEASE_TYPE ||
            defaultConfig.withReleaseType,
        concurrency: toPositiveInteger(
            args.concurrency || env.TMDB_DISCOVER_CONCURRENCY,
            defaultConfig.concurrency
        ),
        retryCount: toPositiveInteger(
            args['retry-count'] || env.TMDB_DISCOVER_RETRY_COUNT,
            defaultConfig.retryCount
        ),
        retryBaseDelayMs: toPositiveInteger(
            args['retry-base-delay-ms'] ||
                env.TMDB_DISCOVER_RETRY_BASE_DELAY_MS,
            defaultConfig.retryBaseDelayMs
        ),
        help: toBoolean(args.help, false) || toBoolean(args.h, false),
    };
}

function buildDiscoverUrl(config, window, page = 1) {
    const url = new URL(`${config.apiBaseUrl}${config.discoverPath}`);
    url.searchParams.set('api_key', config.tmdbApiKey);
    url.searchParams.set('language', config.language);
    url.searchParams.set('sort_by', config.sortBy);
    url.searchParams.set('include_adult', String(config.includeAdult));
    url.searchParams.set('include_video', String(config.includeVideo));
    url.searchParams.set('vote_count.gte', String(config.minVoteCount));
    url.searchParams.set('with_runtime.gte', String(config.minRuntime));
    url.searchParams.set('release_date.gte', window.startDate);
    url.searchParams.set('release_date.lte', window.endDate);
    url.searchParams.set('region', config.region);
    url.searchParams.set('with_release_type', config.withReleaseType);
    url.searchParams.set('page', String(page));

    if (config.excludedGenreIds.length > 0) {
        url.searchParams.set(
            'without_genres',
            config.excludedGenreIds.join(',')
        );
    }

    return url.toString();
}

async function fetchDiscoverPage(config, window, page = 1) {
    const url = buildDiscoverUrl(config, window, page);

    for (let attempt = 0; attempt <= config.retryCount; attempt += 1) {
        let response;

        try {
            response = await fetch(url, {
                headers: {
                    accept: 'application/json',
                    'user-agent': 'jot-tmdb-discover-sync',
                },
            });
        } catch (error) {
            if (attempt >= config.retryCount) throw error;
            await sleep(config.retryBaseDelayMs * 2 ** attempt);
            continue;
        }

        if (response.ok) {
            return await response.json();
        }

        if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
            throw new Error(
                `TMDB discover request failed (${response.status}) for ${window.startDate}..${window.endDate} page ${page}`
            );
        }

        if (attempt >= config.retryCount) {
            throw new Error(
                `TMDB discover request exhausted retries (${response.status}) for ${window.startDate}..${window.endDate} page ${page}`
            );
        }

        const retryDelay =
            parseRetryAfterMilliseconds(response.headers.get('retry-after')) ??
            config.retryBaseDelayMs * 2 ** attempt;
        await sleep(retryDelay);
    }

    throw new Error(
        `Unable to fetch TMDB discover page for ${window.startDate}..${window.endDate}`
    );
}

async function resolveRequestableWindows(config) {
    const pendingWindows = buildYearWindows(config.startDate, config.endDate);
    const requestableWindows = [];
    const splitWindows = [];

    while (pendingWindows.length) {
        const window = pendingWindows.shift();
        const firstPage = await fetchDiscoverPage(config, window, 1);
        const totalPages = Number(firstPage.total_pages || 0);
        const totalResults = Number(firstPage.total_results || 0);

        if (totalPages <= 500) {
            requestableWindows.push({
                ...window,
                totalPages,
                totalResults,
                firstPage,
            });
            continue;
        }

        const nextWindows = splitWindow(window);
        if (!nextWindows) {
            throw new Error(
                `Unable to split oversized discover window ${window.startDate}..${window.endDate} (${totalPages} pages)`
            );
        }

        splitWindows.push({
            startDate: window.startDate,
            endDate: window.endDate,
            totalPages,
        });
        pendingWindows.unshift(nextWindows[1], nextWindows[0]);
    }

    return {
        requestableWindows,
        splitWindows,
    };
}

async function collectWindowMovieIds(config, window) {
    const ids = [];
    const seenIds = new Set();

    const collectPage = (pagePayload) => {
        for (const movie of pagePayload.results || []) {
            const movieId = Number(movie?.id);
            if (!Number.isFinite(movieId) || seenIds.has(movieId)) continue;
            seenIds.add(movieId);
            ids.push(movieId);
        }
    };

    collectPage(window.firstPage);

    const remainingPages = [];
    for (let page = 2; page <= window.totalPages; page += 1) {
        remainingPages.push(page);
    }

    let nextIndex = 0;
    const workerCount = Math.min(config.concurrency, remainingPages.length);

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < remainingPages.length) {
                const page = remainingPages[nextIndex];
                nextIndex += 1;
                const payload = await fetchDiscoverPage(config, window, page);
                collectPage(payload);
            }
        })
    );

    return ids;
}

async function writeJsonAtomic(filePath, value, { pretty = true } = {}) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    const serialized = pretty
        ? JSON.stringify(value, null, 2)
        : JSON.stringify(value);
    await fs.writeFile(tempPath, `${serialized}\n`, 'utf8');
    await fs.rename(tempPath, filePath);
}

export async function runMovieIdSync(
    argv = process.argv.slice(2),
    env = process.env
) {
    await loadDotEnvFile(envFilePath, env);
    const config = createConfig(argv, env);

    if (config.help) {
        process.stdout.write(`${getHelpText()}\n`);
        return null;
    }

    if (!config.tmdbApiKey) {
        throw new Error(
            'Missing TMDB API key. Set TMDB_API_KEY or VITE_TMDB_API_KEY.'
        );
    }

    process.stdout.write(
        `Discover sync: scanning ${config.startDate}..${config.endDate} in ${config.region}\n`
    );

    const { requestableWindows, splitWindows } =
        await resolveRequestableWindows(config);
    const uniqueIds = new Set();
    let totalPageCount = 0;
    let totalResultCount = 0;
    let fetchedWindowCount = 0;

    for (const window of requestableWindows) {
        totalPageCount += window.totalPages;
        totalResultCount += window.totalResults;
        process.stdout.write(
            `Discover sync: ${window.startDate}..${window.endDate} (${window.totalPages} pages, ${window.totalResults} results)\n`
        );
        const windowIds = await collectWindowMovieIds(config, window);
        windowIds.forEach((id) => uniqueIds.add(id));
        fetchedWindowCount += 1;
    }

    const filteredIds = Array.from(uniqueIds).sort(
        (left, right) => left - right
    );
    const manifest = {
        pipelineVersion: 'discover-single-pass-1.0.0',
        generatedAt: new Date().toISOString(),
        runDate: new Date().toISOString().slice(0, 10),
        source: {
            type: 'tmdb-discover-movie',
            region: config.region,
            startDate: config.startDate,
            endDate: config.endDate,
            sortBy: config.sortBy,
        },
        files: {
            filteredIds: config.filteredIdsOutputPath,
        },
        discover: {
            windowCount: requestableWindows.length,
            fetchedWindowCount,
            splitWindowCount: splitWindows.length,
            totalPages: totalPageCount,
            totalResults: totalResultCount,
            dedupedMovieCount: filteredIds.length,
            splitWindows,
        },
        filters: {
            includeAdult: config.includeAdult,
            includeVideo: config.includeVideo,
            minVoteCount: config.minVoteCount,
            minRuntime: config.minRuntime,
            excludedGenreIds: config.excludedGenreIds,
            withReleaseType: config.withReleaseType,
        },
    };

    await writeJsonAtomic(config.filteredIdsOutputPath, filteredIds, { pretty: false });
    await writeJsonAtomic(config.manifestOutputPath, manifest);

    process.stdout.write(
        `Discover sync: saved ${filteredIds.length} ids to ${path.relative(process.cwd(), config.filteredIdsOutputPath)}\n`
    );

    return manifest;
}

if (isMainModule(import.meta.url)) {
    runMovieIdSync().catch((error) => {
        process.stderr.write(
            `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exit(1);
    });
}
