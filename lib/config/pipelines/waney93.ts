// config/waney93-pipeline-a-config.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { IBaseInfrastructureConfig } from '../../interfaces/base-infrastructure';
import { ISharedServicesConfig } from '../../interfaces/shared-services';
import {
  Stage,
  getEnvConfig,
  ResourceConfigFacade,
  getResourceParameterConfig,
  EnvironmentConfig,
} from '../environment';
import { SsmParameterResolver } from '../ssm-parameter-resolver';

// ─── Pipeline-level infrastructure constants ──────────────────────────────────
//
// Only values that are genuinely infrastructure-specific and have no natural
// home in EnvironmentConfig live here. Bastion identity is now in getEnvConfig.
// CDK export names are infrastructure topology decisions — they stay here.

const EXPORTS = {
  vpcId: 'pipeline-a-vpc-id',
  appClientSgId: 'pipeline-a-app-client-sg-id',
  migrationStorageBucketName: 'pipeline-a-migration-storage-bucket-name',
} as const;

const MIGRATION_STORAGE = {
  bucketName: 'waney93-pipeline-a-migration-storage',
} as const;

// ─── Public entry point ───────────────────────────────────────────────────────

export interface Waney93PipelineAConfig {
  baseInfrastructure: IBaseInfrastructureConfig;
  sharedServices: ISharedServicesConfig;
}

export function getWaney93PipelineAConfig(
  scope: Construct,
  stage: Stage,
): Waney93PipelineAConfig {
  // Single call — env is passed down so all builders share one resolved instance.
  const env = getEnvConfig(stage);

  return {
    baseInfrastructure: buildBaseInfrastructureConfig(scope, env),
    sharedServices: buildSharedServicesConfig(scope, stage, env),
  };
}

// ─── Base infrastructure ──────────────────────────────────────────────────────

function buildBaseInfrastructureConfig(
  scope: Construct,
  env: EnvironmentConfig,
): IBaseInfrastructureConfig {
  return {
    network: buildNetworkConfig(scope),
    bastion: buildBastionConfig(env),
    rds: buildRdsConfig(scope),
    exportNames: {
      vpcId: EXPORTS.vpcId,
      appClientSgId: EXPORTS.appClientSgId,
    },
  };
}

function buildNetworkConfig(
  scope: Construct,
): IBaseInfrastructureConfig['network'] {
  return {
    maxAzs: 2,
    natGateways: 1,
    cidrMaskPrivate: 24,
    cidrMaskPublic: 24,
    idPrefix: 'BaseVpc',
    logGrp: new LogGroup(scope, 'VpcFlowLogs', {
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
  };
}

function buildBastionConfig(
  env: EnvironmentConfig,
): IBaseInfrastructureConfig['bastion'] {
  const userData = ec2.UserData.forLinux();
  userData.addCommands(
    'set -eux',
    'sudo dnf -y update',
    'sudo dnf -y install --allowerasing curl postgresql17 python3 jq unzip',
  );

  return {
    instance: {
      type: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
      ami: ec2.MachineImage.latestAmazonLinux2023(),
      userData,
      detailedMonitoring: false,
      tagKey: env.pipeline.bastion.tagKey, 
      tagValue: env.pipeline.bastion.tagValue,
    },
    securityGroup: {
      portRules: [
        {
          port: ec2.Port.tcp(5432),
          description: 'Allow outbound access to Aurora Postgres',
        },
      ],
      allowAllOutbound: true,
    },
    runCommandDocumentName: 'AWS-RunShellScript',
    migrationStorage: {
      migrationStorageBucketExportName: EXPORTS.migrationStorageBucketName,
    },
  };
}

function buildRdsConfig(scope: Construct): IBaseInfrastructureConfig['rds'] {
  return {
    name: 'django-rds-cluster',
    id: 'djangodbcluster',
    databaseName: 'djangodb',
    deletionProtection: false,
    bastionPortRules: [
      {
        port: ec2.Port.tcp(5432),
        description: 'Allow bastion host to connect to Aurora Postgres',
      },
    ],
    appClientPortRules: [
      {
        port: ec2.Port.tcp(5432),
        description: 'Allow ECS tasks to connect to Aurora Postgres',
      },
    ],
    parameterResolver: new SsmParameterResolver(scope),
  };
}

// ─── Shared services ──────────────────────────────────────────────────────────

function buildSharedServicesConfig(
  scope: Construct,
  stage: Stage,
  env: EnvironmentConfig,
): ISharedServicesConfig {
  return {
    ecr: buildEcrConfig(),
    oidc: buildOidcConfig(env),
    migrationOps: buildMigrationOpsConfig(scope, stage, env),
    migrationStorage: buildMigrationStorageConfig(),
  };
}

function buildEcrConfig(): ISharedServicesConfig['ecr'] {
  return {
    repoName: 'waney93-ecr-repo',
    imageScanOnPush: true,
    imageTagMutability: cdk.aws_ecr.TagMutability.IMMUTABLE,
    encryption: cdk.aws_ecr.RepositoryEncryption.KMS,
    lifecycleMaxImageAgeDays: 2,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  };
}

function buildOidcConfig(
  env: EnvironmentConfig,
): ISharedServicesConfig['oidc'] {
  // Repository is now derived from EnvironmentConfig — the application repo
  // that gets deployed is the same one the pipeline tracks.
  return {
    applicationRepository: {
      owner: env.pipeline.repository.owner,
      name: env.pipeline.repository.name,
      branch: env.pipeline.repository.branch,
    },
    provider: {
      name: 'GitHub',
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: [
        '6938fd4d98bab03faadb97b34396831e3780aea1',
        '1c58a3a8518e8759bf075b76b750d4f2df264fcd',
      ],
    },
    ciRole: {
      name: 'DjangoProjectGitHubActionsRole',
      description:
        'Role for GitHub Actions from djangoproject to assume via OIDC',
      stringEqualityConditions: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      },
      stringLikeConditions: {
        'token.actions.githubusercontent.com:sub': `repo:${env.pipeline.repository.owner}/${env.pipeline.repository.name}:*`,
      },
    },
  };
}

function buildMigrationOpsConfig(
  scope: Construct,
  stage: Stage,
  env: EnvironmentConfig,
): ISharedServicesConfig['migrationOps'] {
  const resourceConfig = new ResourceConfigFacade(
    new SsmParameterResolver(scope),
    getResourceParameterConfig(stage),
  );
  const scriptConfig = resourceConfig.getMigrationScriptConfig();

  return {
    automationRunbookName: 'RunMigrationBootstrap',
    runCommandDocumentName: 'BastionMigrationDocument',
    target: {
      instance: {
        tagKey: env.pipeline.bastion.tagKey, // same source as buildBastionConfig
        tagValue: env.pipeline.bastion.tagValue,
      },
    },
    script: {
      folderPath: scriptConfig.folderPath,
      entryFile: scriptConfig.entryFile,
      description: scriptConfig.description,
    },
  };
}

function buildMigrationStorageConfig(): ISharedServicesConfig['migrationStorage'] {
  return {
    s3Bucket: {
      name: MIGRATION_STORAGE.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketId: 'MigrationStorageBucket',
    },
  };
}
