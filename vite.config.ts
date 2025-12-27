import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    build: {
        target: 'esnext',
    },
    server: { https: true }, // Not needed for Vite 5+
    plugins: [
        minifyLiterals(),
        mkcert(),
        VitePWA({
            registerType: 'prompt',
            manifest: {
                name: 'Jot',
                short_name: 'Jot',
                start_url: '/entries',
                shortcuts: [
                    {
                        name: 'Today',
                        url: '/today',
                        description: 'Log today',
                    },
                    {
                        name: '2048',
                        url: '/game',
                        description: 'Play a quick round of 2048',
                    },
                    {
                        name: 'Cycle Locator',
                        url: '/cycle',
                        description: 'London Bikes',
                    },
                    {
                        name: 'Notes',
                        url: '/notes',
                        description: 'Basic note taking',
                    },
                ],
                theme_color: '#000000',
                background_color: '#000000',
                description: 'A daily tracker and journaling PWA',
                icons: [
                    {
                        src: 'pwa-64x64.png',
                        sizes: '64x64',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'maskable-icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
        }),
    ],
});
