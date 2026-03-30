import fs from 'fs';
import https from 'https';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/generated');
const outputPath = path.join(outputDir, 'filtered_movie_ids.json');

const today = new Date();
const pad = (value) => String(value).padStart(2, '0');

function formatDate(date) {
    return `${pad(date.getMonth() + 1)}_${pad(date.getDate())}_${date.getFullYear()}`;
}

function downloadStream(targetUrl) {
    return new Promise((resolve, reject) => {
        https
            .get(
                targetUrl,
                {
                    headers: {
                        'user-agent': 'jot-movie-faceoff-build-script',
                    },
                },
                (response) => {
                if (
                    response.statusCode &&
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    resolve(downloadStream(response.headers.location));
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(
                        new Error(
                            `Failed to download TMDB export (${response.statusCode})`
                        )
                    );
                    return;
                }

                resolve(response);
                }
            )
            .on('error', reject);
    });
}

async function downloadLatestAvailableStream(maxLookbackDays = 14) {
    let lastError;

    for (let offset = 0; offset <= maxLookbackDays; offset++) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const dateStr = formatDate(date);
        const url = `https://files.tmdb.org/p/exports/movie_ids_${dateStr}.json.gz`;

        try {
            process.stdout.write(`Trying TMDB export ${dateStr}\n`);
            const stream = await downloadStream(url);
            return { stream, dateStr };
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            process.stdout.write(`Skipped ${dateStr}: ${message}\n`);
        }
    }

    throw lastError || new Error('Unable to download a recent TMDB export');
}

async function generateMovieIds() {
    fs.mkdirSync(outputDir, { recursive: true });

    const { stream: responseStream, dateStr } = await downloadLatestAvailableStream();
    const gunzip = zlib.createGunzip();
    const lineReader = readline.createInterface({
        input: responseStream.pipe(gunzip),
        crlfDelay: Infinity,
    });

    const ids = [];

    for await (const line of lineReader) {
        if (!line.trim()) continue;
        try {
            const movie = JSON.parse(line);
            if (!movie.adult && movie.popularity > 10) {
                ids.push(movie.id);
            }
        } catch (_error) {
            // Ignore malformed lines so one bad row doesn't kill the build.
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(ids));
    process.stdout.write(
        `Saved ${ids.length} movie ids from ${dateStr} to ${path.relative(process.cwd(), outputPath)}\n`
    );
}

generateMovieIds().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
