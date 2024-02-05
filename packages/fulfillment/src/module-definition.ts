import { ModuleExports } from "@medusajs/types"
import * as ModuleServices from "@services"
import { FulfillmentModuleService } from "@services"
import { Modules } from "@medusajs/modules-sdk"
import * as Models from "@models"
import * as ModuleModels from "@models"
import { ModulesSdkUtils } from "@medusajs/utils"
import * as ModuleRepositories from "@repositories"

const migrationScriptOptions = {
  moduleName: Modules.FULFILLMENT,
  models: Models,
  pathToMigrations: __dirname + "/migrations",
}

export const runMigrations = ModulesSdkUtils.buildMigrationScript(
  migrationScriptOptions
)
export const revertMigration = ModulesSdkUtils.buildRevertMigrationScript(
  migrationScriptOptions
)

const containerLoader = ModulesSdkUtils.moduleContainerLoaderFactory({
  moduleModels: ModuleModels,
  moduleRepositories: ModuleRepositories,
  moduleServices: ModuleServices,
})

const connectionLoader = ModulesSdkUtils.mikroOrmConnectionLoaderFactory({
  moduleName: Modules.FULFILLMENT,
  moduleModels: Object.values(Models),
  migrationsPath: __dirname + "/migrations",
})

const service = FulfillmentModuleService
const loaders = [containerLoader, connectionLoader] as any

export const moduleDefinition: ModuleExports = {
  service,
  loaders,
  revertMigration,
  runMigrations,
}
