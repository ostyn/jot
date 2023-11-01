import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'esnext',
    },
    plugins: [minifyLiterals()],
});
