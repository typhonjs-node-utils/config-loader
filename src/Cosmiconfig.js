import path             from 'path';

import CC               from 'cosmiconfig';

import esmLoader        from './esmLoader.js';

/**
 * Defines the default configuration file locations `cosmiconfig`.
 *
 * @param {string}   moduleName - The module name to build the default locations.
 *
 * @returns {string[]} List of configuration file names based on `moduleName`.
 */
const s_DEFAULT_SEARCH_PLACES = (moduleName) => [
   'package.json',
   `.${moduleName}rc`,
   `.${moduleName}rc.json`,
   `.${moduleName}rc.yaml`,
   `.${moduleName}rc.yml`,
   `.${moduleName}rc.js`,
   `.${moduleName}rc.mjs`,
   `.${moduleName}rc.cjs`,
   `.${moduleName}.json`,
   `.${moduleName}.yaml`,
   `.${moduleName}.yml`,
   `${moduleName}.config.js`,
   `${moduleName}.config.mjs`,
   `${moduleName}.config.cjs`,
   `${moduleName}.config.json`,
   `${moduleName}.config.yaml`,
   `${moduleName}.config.yml`
];

/**
 * Provides a TyphonJS plugin using comsiconfig to load config files including extensible support.
 */
export default class Cosmiconfig
{
   /**
    * Uses cosmiconfig to attempt to load a local configuration file based on a module name. Other plugins may
    * provide additional file type support. For instance `@typhonjs-node-rollup/plugin-typescript` provides support for
    * loading Typescript configuration files.
    *
    * The default locations for config file loading given a module name are as follows. This is an exhaustive list.
    *
    * 'package.json',
    * `.${moduleName}rc`,
    * `.${moduleName}rc.json`,
    * `.${moduleName}rc.yaml`,
    * `.${moduleName}rc.yml`,
    * `.${moduleName}rc.js`,
    * `.${moduleName}rc.mjs`,
    * `.${moduleName}rc.cjs`,
    * `.${moduleName}.json`,
    * `.${moduleName}.yaml`,
    * `.${moduleName}.yml`,
    * `${moduleName}.config.js`,
    * `${moduleName}.config.mjs`,
    * `${moduleName}.config.cjs`,
    * `${moduleName}.config.json`,
    * `${moduleName}.config.yaml`,
    * `${moduleName}.config.yml`
    *
    * @param {object}   options - Options object
    *
    * @param {string}   options.moduleName - The module name to load a config file.
    *
    * @param {string}   [options.packageName] - The package name for the module loading this configuration file.
    *
    * @param {string[]} [options.mergeExternal=true] - When set to false will not merge any external plugin defined
    *                                                  `searchPlaces`.
    *
    * @param {string[]} [options.searchPlaces] - Explicit list of search places.
    *
    * @param {string}   [options.startDir=process.cwd] - Absolute path of start directory.
    *
    * @param {string}   [options.stopDir=process.cwd] - Absolute path of stop directory.
    *
    * @returns {Promise<object|null>} An object with loaded configuration data or null.
    */
   async loadConfig(options)
   {
      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'`); }
      if (typeof options.moduleName !== 'string') { throw new TypeError(`'options.moduleName' is not a 'string'`); }

      const moduleName = options.moduleName;
      const packageName = typeof options.packageName === 'string' ? `${options.packageName}: ` : '';
      const mergeExternal = typeof options.mergeExternal === 'boolean' ? options.mergeExternal : true;
      const startDir = typeof options.startDir === 'string' ? options.startDir : process.cwd();
      const stopDir = typeof options.stopDir === 'string' ? options.stopDir : process.cwd();

      // Make a request for any externally provided cosmiconfig plugin support.
      const remoteCosmic = this._eventbus !== void 0 ? await this._eventbus.triggerAsync(
       'typhonjs:utils:cosmiconfig:config:support:get', moduleName) : void 0;

      let mergeCosmic = [];

      // Make sure remote input plugins is structured as an array.
      if (remoteCosmic !== void 0)
      {
         if (!Array.isArray(remoteCosmic)) { mergeCosmic.push(remoteCosmic); }
         else { mergeCosmic = remoteCosmic.flat().filter((entry) => entry !== void 0); }
      }

      // Merge results -------------------

      const searchPlacesMerge = Array.isArray(options.searchPlaces) ? options.searchPlaces :
       s_DEFAULT_SEARCH_PLACES(moduleName);

      let loaders = {
         '.js': esmLoader,
         '.mjs': esmLoader
      };

      // Merge results from externally provided cosmiconfig data (searchPlaces & loaders).
      for (const cosmic of mergeCosmic)
      {
         if (mergeExternal && Array.isArray(cosmic.searchPlaces))
         {
            searchPlacesMerge.push(...cosmic.searchPlaces);
         }

         if (typeof cosmic.loaders === 'object')
         {
            loaders = Object.assign(loaders, cosmic.loaders);
         }
      }

      // Define to cosmiconfig options. Stop at the original CWD.
      const cosmicOptions = {
         stopDir,
         loaders,
         searchPlaces: searchPlacesMerge
      };

      const explorer = CC.cosmiconfig(moduleName, cosmicOptions);

      let result = null;

      try
      {
         result = await explorer.search(startDir);
      }
      catch (error)
      {
         if (this._eventbus !== void 0)
         {
            this._eventbus.trigger('log:error',
             `${packageName}Loading local configuration file for ${moduleName} failed...\n${error.message}`);
         }
      }

      // Potentially return null at this point before formatting the final result.
      if (result === null) { return null; }

      // Normalize the result from cosmiconfig with a little extra data.
      return {
         config: result.config,
         filepath: result.filepath,
         filename: path.basename(result.filepath),
         extension: path.extname(result.filepath).toLowerCase(),
         relativePath: getRelativePath(startDir, result.filepath)
      };
   }

   /**
    * Opens a local configuration file with additional sanity checking and handling of a provided default config.
    *
    * @param {object}   options - Options object
    *
    * @param {string}   options.moduleName - The module name to load a config file.
    *
    * @param {string}   [options.packageName] - The package name for the module loading this configuration file.
    *
    * @param {string}   [options.defaultConfig=null] - The default configuration if loading fails.
    *
    * @param {string[]} [options.mergeExternal=true] - When set to false will not merge any external plugin defined
    *                                                  `searchPlaces`.
    *
    * @param {string[]} [options.searchPlaces] - Explicit list of search places.
    *
    * @param {string}   [options.startDir=process.cwd] - Absolute path of start directory.
    *
    * @param {string}   [options.stopDir=process.cwd] - Absolute path of stop directory.
    *
    * @returns {Promise<object|null>} An object with loaded configuration data or null.
    */
   async loadConfigSafe(options)
   {
      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'`); }
      if (typeof options.moduleName !== 'string') { throw new TypeError(`'options.moduleName' is not a 'string'`); }

      const moduleName = options.moduleName;
      const defaultConfig = typeof options.defaultConfig === 'object' ? options.defaultConfig : null;
      const packageName = typeof options.packageName === 'string' ? `${options.packageName}: ` : '';

      const result = await this.loadConfig(options);

      if (result !== null)
      {
         if (typeof result.config === 'object')
         {
            if (Object.keys(result.config).length === 0)
            {
               if (this._eventbus !== void 0)
               {
                  this._eventbus.trigger('log:warn', `${packageName}Local ${moduleName} configuration file ` +
                   `empty using default config:\n${result.relativePath}`);
               }

               return defaultConfig;
            }

            if (this._eventbus !== void 0)
            {
               this._eventbus.trigger('log:verbose',
                `${packageName}Deferring to local ${moduleName} configuration file.\n${result.relativePath}`);
            }

            return result.config;
         }
         else
         {
            if (this._eventbus !== void 0)
            {
               this._eventbus.trigger('log:warn', `${packageName}Local ${moduleName} configuration file ` +
                `malformed using default config; expected an 'object':\n${result.relativePath}`);
            }

            return defaultConfig;
         }
      }

      return defaultConfig;
   }

   /**
    * Wires up FlagHandler on the plugin eventbus.
    *
    * @param {object} ev - PluginEvent - The plugin event.
    *
    * @see https://www.npmjs.com/package/typhonjs-plugin-manager
    *
    * @ignore
    */
   onPluginLoad(ev)
   {
      this._eventbus = ev.eventbus;

      this._eventbus.on(`typhonjs:utils:cosmiconfig:config:load`, this.loadConfig, this, { guard: true });
      this._eventbus.on(`typhonjs:utils:cosmiconfig:config:load:safe`, this.loadConfigSafe, this, { guard: true });
   }
}

// Module Private ----------------------------------------------------------------------------------------------------

/**
 * Given a base path and a file path this method will return a relative path if the file path includes the base
 * path otherwise the full absolute file path is returned.
 *
 * @param {string}   basePath - The base file path to create a relative path from `filePath`
 *
 * @param {string}   filePath - The relative path to adjust from `basePath`.
 *
 * @returns {string} A relative path based on `basePath` and `filePath`.
 */
function getRelativePath(basePath, filePath)
{
   let returnPath = filePath;

   // Get the relative path and append `./` if necessary.
   if (filePath.startsWith(basePath))
   {
      returnPath = path.relative(basePath, filePath);
      returnPath = returnPath.startsWith('.') ? returnPath : `.${path.sep}${returnPath}`;
   }

   return returnPath;
}
