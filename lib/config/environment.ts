import { EcsParamConfig } from '../interfaces/ecs';
import {
  IParameterResolver,
  MigrationScriptConfig,
  ResolvedDatabaseCredentials,
  ResourceParameterConfig,
} from '../interfaces/parameter-resolver';
import { PipelineIdentityConfig } from '../interfaces/pipeline';

export type Stage = 'dev' | 'test' | 'prod';

export interface EnvironmentConfig {
  stage: Stage;
  cognito?: { acmCertificateArnParameter?: string };
  pipeline: {
    name: string;
    description: string;
    repository: { owner: string; name: string; branch: string };
    codestar: { connectionArnParameter: string };
    notifications?: { emailParameter: string };
    skip_foundations?: boolean;
    bastion: {
      tagKey: string;
      tagValue: string;
    };
  };
}

export type CfnOutputExportNames = {
  cognito?: {
    userPoolId?: string;
    certificateArn?: string;
  };
  network?: {
    vpcId?: string;
    appClientSgId?: string;
  };
  storage?: {
    migrationStorageBucketArn?: string;
  };
};

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
  const pipelineName = `Waney93${pascalStage}Pipeline`;

  return {
    stage,
    cognito: { acmCertificateArnParameter: ACM_CERTIFICATE_ARN_PARAM },
    pipeline: {
      name: pipelineName,
      description: `Pipeline for the Waney93 ${stage} stage`,
      repository: { ...REPO, branch },
      codestar: { connectionArnParameter: CODESTAR_CONNECTION_ARN_PARAM },
      notifications: { emailParameter: NOTIFICATIONS_EMAIL_PARAM },
      skip_foundations: stage === 'prod',
      bastion: {
        tagKey: 'Name',
        tagValue: `${pipelineName.toLowerCase()}-bastion`,
      },
    },
  };
}

export function getResourceParameterConfig(
  stage: Stage,
): ResourceParameterConfig {
   const base = `/waney93/${stage}`;
  return {
    databaseCredentials: {
      loginSecretName: `${base}/aurora/secret-name`,
      appUser: {
        name: `${base}/app-user-name`,
        secretName: `${base}/aurora/app-user-secret-name`,
      },
      adminUsername: `${base}/aurora/admin-name`,
    },
    migration: {
      folderPath: `${base}/migration-scripts/folder`,
      entryFile: `${base}/migration-scripts/entryfile`,
      description: `${base}/migration-scripts/description`,
    },
    ecs: {
      apiCertArn: `${base}/ecs/api-cert-arn`,
      imageTag: `${base}/ecs/image-tag`,
      alertEmailAddress: `${base}/ecs/alert-email-address`,
    },
    pipelineIdentity: {
      bastionTagValue: `${base}/identity/bastion-tag-value`,
      ecrRepoName: `${base}/identity/ecr-repo-name`,
      exports: {
        vpcId: `${base}/exports/vpc-id`,
        appClientSgId: `${base}/exports/app-client-sg-id`,
        migrationStorageBucketArn: `${base}/exports/migration-storage-bucket-arn`,
      },
      migrationStorage: {
        bucketName: `${base}/migration/bucket-name`,
      },
    },
  };
}

export class ResourceConfigFacade {
  static readonly ExportedValueName: CfnOutputExportNames = {
    cognito: {
      userPoolId: 'CognitoUserPoolId',
      certificateArn: 'CognitoDomainCertArn',
    },
    network: {
      vpcId: 'networkid',
      appClientSgId: 'appClientSgId',
    },
    storage: {
      migrationStorageBucketArn: 'MigrationStorageBucketArn',
    },
  };
  static readonly VersionLock = {
    AUTOMATION_SCHEMA_VERSION: '0.3',
    SSM_COMMAND_SCHEMA_VERSION: '2.2',
  };
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
      adminUsername: this.resolver.getString(
        this.config.databaseCredentials.adminUsername,
      ),
    };
  }

  public getMigrationScriptConfig(): MigrationScriptConfig {
    return {
      folderPath: this.resolver.getString(this.config.migration.folderPath),
      entryFile: this.resolver.getString(this.config.migration.entryFile),
      description: this.resolver.getString(this.config.migration.description),
    };
  }

  public getEcsConfig(): EcsParamConfig {
    return {
      apiCertArn: this.resolver.getString(this.config.ecs.apiCertArn),
      imageTag: this.resolver.getString(this.config.ecs.imageTag),
      alertEmailAddress: this.resolver.getString(
        this.config.ecs.alertEmailAddress,
      ),
    };
  }

  public getCognitoConfig(envConfig: EnvironmentConfig['cognito']) {
    return {
      cognitoCertArn: this.resolver.getString(
        envConfig?.acmCertificateArnParameter ?? '',
      ),
    };
  }

  public getPipelineIdentityConfig(): PipelineIdentityConfig {
    return {
      bastionTagValue: this.resolver.getString(
        this.config.pipelineIdentity.bastionTagValue,
      ),
      ecrRepoName: this.resolver.getString(
        this.config.pipelineIdentity.ecrRepoName,
      ),
      exports: {
        vpcId: this.resolver.getString(
          this.config.pipelineIdentity.exports.vpcId,
        ),
        appClientSgId: this.resolver.getString(
          this.config.pipelineIdentity.exports.appClientSgId,
        ),
        migrationStorageBucketArn: this.resolver.getString(
          this.config.pipelineIdentity.exports.migrationStorageBucketArn,
        ),
      },
      migrationStorage: {
        bucketName: this.resolver.getString(
          this.config.pipelineIdentity.migrationStorage.bucketName,
        ),
      },
    };
  }
}
