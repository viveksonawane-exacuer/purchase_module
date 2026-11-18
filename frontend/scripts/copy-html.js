// Copy the built index.html into the Frappe www folder as procure.html
import { copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
copyFileSync(
  resolve(here, '../../purchase_module/public/procure/index.html'),
  resolve(here, '../../purchase_module/www/procure.html'),
)
console.log('copied index.html -> purchase_module/www/procure.html')
