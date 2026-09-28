import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, previews).
  base: './',
  plugins: [preact()],
})
