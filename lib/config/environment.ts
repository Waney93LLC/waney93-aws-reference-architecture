import { IParameterResolver, MigrationScriptConfig, ResolvedDatabaseCredentials, ResourceParameterConfig } from '../interfaces/parameter-resolver';

export type Stage = 'dev' | 'test' | 'prod';

export interface EnvironmentConfig {
  stage: Stage;
  cognito?: { acmCertificateArnParameter?: string };
  pipeline: {
    name: string;
    description: string;
    repository: { owner: string; name: string; branch: string };
    codestar: { connectionArnParameter: string };
    notifications?: {
      emailParameter: string;
    };
    skip_foundations?: boolean;
  };
}

const REPO = {
  owner: 'Waney93LLC',
  name: 'waney93-aws-reference-architecture',
} as const;

// single per account (or shared) parameter
const CODESTAR_CONNECTION_ARN_PARAM = '/waney93/shared/codestar/connection-arn';
const NOTIFICATIONS_EMAIL_PARAM = '/waney93/shared/notifications/email';
const ACM_CERTIFICATE_ARN_PARAM = '/waney93/shared/cognito/cert-arn';

const STAGE_OVERRIDES: Record<Stage, { branch: string }> = {
  dev: { branch: 'dev' },
  test: { branch: 'test' },
  prod: { branch: 'main' },
};

export function getEnvConfig(stage: Stage): EnvironmentConfig {
  const { branch } = STAGE_OVERRIDES[stage];

  const pascalStage = stage[0].toUpperCase() + stage.slice(1);

  return {
    stage,
    cognito: { acmCertificateArnParameter: ACM_CERTIFICATE_ARN_PARAM },
    pipeline: {
      name: `Waney93${pascalStage}Pipeline`,
      description: `Pipeline for the Waney93 ${stage} stage`,
      repository: { ...REPO, branch },
      codestar: { connectionArnParameter: CODESTAR_CONNECTION_ARN_PARAM },
      notifications: { emailParameter: NOTIFICATIONS_EMAIL_PARAM },
      skip_foundations: stage === 'prod',
    },
  };
}

export function getResourceParameterConfig(
  stage: Stage,
): ResourceParameterConfig {
  return {
    databaseCredentials: {
      loginSecretName: `/waney93/${stage}/aurora/secret-name`,
      appUser: {
        name: `/waney93/${stage}/app-user-name`,
        secretName: `/waney93/${stage}/aurora/app-user-secret-name`,
      },
    },
    migration: {
      folderPath: `/waney93/${stage}/migration-scripts`,
      entryFile: 'migration-config.json',
      description: 'Migration script for on-prem to RDS migration',
    },
  };
}

export class ResourceConfigFacade {
  constructor(
    private readonly resolver: IParameterResolver,
    private readonly config: ResourceParameterConfig,
  ) {}

  public getDatabaseCredentials(): ResolvedDatabaseCredentials {
    return {
      loginSecretName: this.resolver.getString(
        this.config.databaseCredentials.loginSecretName,
      ),
      appUserName: this.resolver.getString(
        this.config.databaseCredentials.appUser.name,
      ),
      appUserSecretName: this.resolver.getString(
        this.config.databaseCredentials.appUser.secretName,
      ),
    };
  }

  public getMigrationScriptConfig(): MigrationScriptConfig {
    return this.config.migration;
  }
}