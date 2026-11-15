// MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site is served from https://oryx-geo.github.io/marsad/
export default defineConfig({
  base: '/marsad/',
  plugins: [react()],
})
