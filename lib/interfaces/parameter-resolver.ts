import { ECS_PARAM_CONFIG } from "./ecs";

/**
 * Interface for resolving parameters from various sources (e.g., environment variables, configuration files, etc.).
 * This abstraction allows for flexibility in how parameters are provided to the application, enabling support for different environments and configurations without changing the underlying code that consumes these parameters.
 */
export interface IParameterResolver {
  getString(name: string): string;
  getStrings(names: Record<string, string>): Record<string, string>;
}

/**
 * DatabaseCredentialParameterNames defines the structure for the parameter names related to database credentials, including the login secret and application user credentials. This allows for a consistent way to reference these parameters across the application.
 */
export interface DatabaseCredentialParameterNames {
  loginSecretName: string;
  appUser: {
    name: string;
    secretName: string;
  };
  adminUsername: string;
}

/**
 * MigrationScriptConfig defines the structure for the configuration of migration scripts, including the folder path where the scripts are located, the entry file that contains the migration configuration, and a description of the migration. This allows for a standardized way to reference migration script configurations across the application.
 */
export interface MigrationScriptConfig {
  folderPath: string;
  entryFile: string;
  description: string;
}

/**
 * ResourceParameterConfig defines the structure for the parameters required to configure resources, including database credentials and migration script configuration. This allows for a centralized definition of all parameters needed for resource configuration, making it easier to manage and maintain these parameters across different environments and stages of deployment.
 */
export interface ResourceParameterConfig {
  databaseCredentials: DatabaseCredentialParameterNames;
  migration: MigrationScriptConfig;
  ecs: ECS_PARAM_CONFIG;
}

/**
 * ResolvedDatabaseCredentials defines the structure for the actual values of database credentials after they have been resolved from their parameter names. This includes the login secret name, application user name, and application user secret name. This allows for a clear distinction between the parameter names used to reference these credentials and the actual values that are used in the application logic.
 */
export interface ResolvedDatabaseCredentials {
  loginSecretName: string;
  appUserName: string;
  appUserSecretName: string;
  adminUsername: string; 
}