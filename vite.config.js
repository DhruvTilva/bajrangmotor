import { defineConfig } from 'vite';
import { business, whatsappUrl, hoursNote } from './src/data/business.js';

// Replaces {{path.to.value}} tokens in index.html with values from src/data/business.js,
// so contact details live in one file but still ship as plain, crawlable HTML.
function businessTokens() {
  const context = { ...business, whatsappUrl, hoursNote, year: new Date().getFullYear() };
  const resolve = (path) => path.split('.').reduce((obj, key) => obj?.[key], context);
  return {
    name: 'business-tokens',
    transformIndexHtml(html) {
      return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
        const value = resolve(path);
        if (value === undefined) throw new Error(`Unknown business token: ${match}`);
        return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      });
    },
  };
}

export default defineConfig({
  plugins: [businessTokens()],
  server: { port: 5173 },
  preview: { allowedHosts: ['bajrangmotor.onrender.com'] },
  build: { rollupOptions: { input: { main: 'index.html', credits: 'credits.html' } } },
});
