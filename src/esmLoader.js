import ModuleLoader  from '@typhonjs-utils/loader-module';

export default async (modulepath) =>
{
   const result = await ModuleLoader.load(modulepath);

   if (!('default' in result.module))
   {
      throw new Error(`No default export: ${modulepath}`);
   }

   return result.module.default;
}
