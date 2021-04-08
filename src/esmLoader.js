import path                from 'path';
import url                 from 'url';

import { getPackageType }  from '@typhonjs-node-utils/package-util';

/**
 * Uses `getPackageType` to determine if `type` is set to 'module. If so loads '.js' files as ESM otherwise uses
 * a bare require to load as CJS. Also loads '.mjs' files as ESM.
 *
 * Uses dynamic import to load ESM files.
 *
 * @param {string}   filepath - File path to load.
 *
 * @returns {Promise<*>} The imported default ESM export or CJS file by require.
 */
export default async (filepath) =>
{
   const extension = path.extname(filepath).toLowerCase();

   switch (extension)
   {
      case '.js':
         // Attempt to load `.js` file as ESM if 'package.type' is 'module'.
         if (getPackageType({ filepath }) === 'module')
         {
            return esmLoader(filepath);
         }

         // Otherwise use require and consider it CJS.
         return require(filepath);

      case '.mjs':
         return esmLoader(filepath);
   }
};

/**
 * Uses dynamic import to load an ES Module. The module must have a default export.
 *
 * @param {string}   modulePath - The module path.
 *
 * @returns {Promise<*>} The imported default ESM export.
 */
async function esmLoader(modulePath)
{
   const module = await import(url.pathToFileURL(modulePath));

   if (!('default' in module))
   {
      throw new Error(`${modulePath} has no default export.`);
   }

   return module.default;
}
