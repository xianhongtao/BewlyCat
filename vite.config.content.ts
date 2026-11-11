import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

import packageJson from './package.json'
import { thirdPartyLicensesVitePlugin } from './scripts/thirdPartyLicenses'
import { embedBundledStyles, watchLocaleFiles } from './scripts/uiBundlePlugins'
import { isDev, isFirefox, isSafari, r } from './scripts/utils'
import { sharedConfig } from './vite.config'

// bundling the content script using Vite
export default defineConfig({
  ...sharedConfig,
  plugins: [
    UnoCSS(),
    ...sharedConfig.plugins!,
    embedBundledStyles(),
    watchLocaleFiles(),
    thirdPartyLicensesVitePlugin('content'),
  ],
  build: {
    watch: isDev
      ? { include: ['./**/*'] }
      : undefined,
    outDir: r(isFirefox ? 'extension-firefox/dist/contentScripts' : isSafari ? 'extension-safari/dist/contentScripts' : 'extension/dist/contentScripts'),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
    lib: {
      entry: r('src/contentScripts/index.ts'),
      name: packageJson.name,
      formats: ['iife'],
    },
    rollupOptions: {
      // Disable Rollup cache in dev mode to ensure locale file changes are picked up
      cache: isDev ? false : undefined,
      output: {
        entryFileNames: 'index.global.js',
        assetFileNames: 'style.css',
        extend: true,
      },
    },
  },
  // 内容脚本是 IIFE，且与页面不同源。扩散求解打成经典 inline Worker（blob），
  // Chrome 与 Firefox 的内容脚本才能启动；module worker 在 Firefox 内容脚本里不可靠。
  worker: {
    format: 'iife',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
