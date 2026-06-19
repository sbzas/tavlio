import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel   from '@rolldown/plugin-babel'
import wails from "@wailsio/runtime/plugins/vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1'
  }, 
  plugins: [
    babel({
      presets: [reactCompilerPreset()]
    }),
    react(),
    wails("./bindings")
  ],
})
