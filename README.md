# Jot - Your Daily Tracker and Journaling App

Jot is a Progressive Web App (PWA) designed to help you keep track of your daily activities and thoughts. I built it out of my own desire to remember and regret less.

Try it out! https://jot.regretless.life/

## Features

- **Flexible Activity and Mood Tracking**: Keep track of your daily activities and moods with ease and however you find useful
- **Quick and Easy Searching**: Looking for more details about something? Use full text search to find what you're looking for
- **A fully offline PWA**: Offline and installable on any device
- **Full Data Privacy** Your data stays your data, on your device. Need a backup? Easily export and back up to JSON file or your own personal Google Drive
- **Daylio Import**: Coming from Daylio? Get a jumpstart with your existing Daylio data

## Tech Stack

Jot is built with a modern tech stack including:

- **TypeScript and Vite**: For supporting a dev-friendly buildchain
- **Lit**: For creating web components
- **Vaadin Router**: For in-app routing
- **MobX**: For application state
- **Dexie**: For simplifying IndexedDB interactions
- **PicoCSS**: For a minimal CSS framework
- **Lucide**: For SVG icons
- **GoatCounter**: For simple web analytics

## Getting Started

### Prerequisites

- Node
- yarn

### Installation

1. Clone the repo
    ```sh
    git clone https://github.com/ostyn/jot.git
    ```
2. Install NPM packages
    ```sh
    yarn
    ```

### Available Scripts

In the project directory, you can run:

- `yarn dev`: Starts the development server.
- `yarn build`: Compiles the application for production using the checked-in generated movie assets.
- `yarn preview`: Serves the production build for preview.
- `yarn generate:movie-ids`: Runs the TMDB discover-based movie id sync.

## TMDB Movie Pipeline

The movie faceoff feature uses a single-stage TMDB discover sync that generates a filtered id list for the app without doing a second enrichment crawl.

- The generator uses TMDB's `discover/movie` endpoint with conservative defaults like `vote_count.gte=50`, `with_runtime.gte=60`, `without_genres=10770`, `region=US`, and `with_release_type=2|3|4`.
- Large result sets are split into smaller release-date windows so the sync stays under TMDB's discover pagination cap.
- The app still consumes `public/generated/filtered_movie_ids.json` and fetches per-movie details lazily at runtime.

Run `yarn generate:movie-ids` whenever you want to refresh the catalog.

## Contributing

Any contributions would be greatly appreciated!
