import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site is served from https://oryx-geo.github.io/marsad/
export default defineConfig({
  base: '/marsad/',
  plugins: [react()],
})
