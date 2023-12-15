import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    build: {
        target: 'esnext',
    },
    plugins: [
        minifyLiterals(),
        VitePWA({
            registerType: 'prompt',
        }),
    ],
});
