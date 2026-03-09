import { MigrationOperations } from '../../interfaces/bastion';


/**
 * This is an S3 compatible migration script template. It will download the migration configuration and assets from S3, then execute the migration process.
 * @param scriptS3Url The S3 URL where the migration scripts and configuration are stored.
 * @param entryFile The entry file for the migration process, which contains the necessary configuration for the migration.
 * @returns An array of strings representing the shell commands to be executed on the bastion host to perform the migration.
 */
export const getS3MigrationScriptSteps = (
  scriptS3Url: string,
  entryFile: string,
): string[] => [
  'set -euxo pipefail',
  'cd /home/ec2-user',
  `export MIGRATION_URI="${scriptS3Url}" `,
  `export MIGRATION_CONFIG_FILE="${entryFile}" `,
  `aws s3 cp $MIGRATION_URI$MIGRATION_CONFIG_FILE .`,
  'export ASSETS_FOLDER=$(jq -r ".assets_folder" $MIGRATION_CONFIG_FILE)',
  'export MIGRATION_ASSETS="${ASSETS_FOLDER}.zip"',
  'aws s3 cp $MIGRATION_URI$MIGRATION_ASSETS .',
  'unzip $MIGRATION_ASSETS -d "${ASSETS_FOLDER}"',
  'mv "${ASSETS_FOLDER}/${ASSETS_FOLDER}"/* .',
  'rm -rf "${ASSETS_FOLDER}"',
  'rm "${ASSETS_FOLDER}.zip"',
  'export DATA_DUMP_FILE=$(jq -r ".data_dump_file" $MIGRATION_CONFIG_FILE)',
  'export SECRET_ID=$(jq -r ".db_secret_id" $MIGRATION_CONFIG_FILE)',
  'export APP_USER_SECRET_ID=$(jq -r ".app_user_secret_id" $MIGRATION_CONFIG_FILE)',
  'export MIGRATION_PROCESS_FILE=$(jq -r ".migration_process_file" $MIGRATION_CONFIG_FILE)',
  'chmod +x $MIGRATION_PROCESS_FILE',
  './$MIGRATION_PROCESS_FILE',
];

export const getDatabaseMigrationParameterConfig = (
  stage: string,
): MigrationOperations['databaseCredentials'] => {
  return {
      loginSecretName: `/waney93/${stage}/aurora/secret-name`,
      appUser: {
        name: `/waney93/${stage}/app-user-name`,
        secretName: `/waney93/${stage}/aurora/app-user-secret-name`,
      },
  };
};

export const getScriptMigrationParameterConfig = (
  stage: string,
): MigrationOperations['config']['script'] => {
  return {
      folderPath: `waney93/${stage}/migration-scripts/`,
      entryFile: `migration-config.json`,
      description: 'Migration script for on-prem to RDS migration',

  };
};