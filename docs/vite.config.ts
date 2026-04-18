import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import mdx from 'fumadocs-mdx/vite';
import * as path from 'node:path';
import * as MdxConfig from './source.config';

export default defineConfig({
  plugins: [mdx(MdxConfig), tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
      collections: path.resolve(__dirname, './.source'),
    },
  },
  ssr: {
    external: ['@takumi-rs/image-response'],
  },
});
