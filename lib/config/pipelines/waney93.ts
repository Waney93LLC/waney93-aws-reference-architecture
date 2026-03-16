// config/waney93-pipeline-a-config.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { IBaseInfrastructureConfig } from '../../interfaces/base-infrastructure';
import { ISharedServicesConfig } from '../../interfaces/shared-services';
import { Stage } from '../environment';
import { SsmParameterResolver } from '../ssm-parameter-resolver';
import {
  ResourceConfigFacade,
  getResourceParameterConfig,
} from '../environment';

export interface Waney93PipelineAConfig {
  baseInfrastructure: IBaseInfrastructureConfig;
  sharedServices: ISharedServicesConfig;
}

export function getWaney93PipelineAConfig(
  scope: Construct,
  stage: Stage,
): Waney93PipelineAConfig {
  return {
    baseInfrastructure: buildBaseInfrastructureConfig(scope),
    sharedServices: buildSharedServicesConfig(scope, stage),
  };
}

// ─── Base infrastructure ─────────────────────────────────────────────────────

function buildBaseInfrastructureConfig(
  scope: Construct,
): IBaseInfrastructureConfig {
  return {
    network: buildNetworkConfig(scope),
    bastion: buildBastionConfig(),
    rds: buildRdsConfig(scope),
    exportNames: {
      vpcId: 'pipeline-a-vpc-id',
      appClientSgId: 'pipeline-a-app-client-sg-id',
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

function buildBastionConfig(): IBaseInfrastructureConfig['bastion'] {
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
      tagKey: 'Name',
      tagValue: 'waney93-bastion',
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
      migrationStorageBucketExportName:
        'pipeline-a-migration-storage-bucket-name',
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

// ─── Shared services ─────────────────────────────────────────────────────────

function buildSharedServicesConfig(
  scope: Construct,
  stage: Stage,
): ISharedServicesConfig {
  return {
    ecr: buildEcrConfig(),
    oidc: buildOidcConfig(),
    migrationOps: buildMigrationOpsConfig(scope, stage),
    migrationStorage: buildMigrationStorageConfig(),
    // cognito is omitted — Pipeline A does not require it.
    // Add it here when an ACM certificate is available.
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

function buildOidcConfig(): ISharedServicesConfig['oidc'] {
  return {
    applicationRepository: {
      owner: 'Waney93LLC',
      name: 'djangoproject',
      branch: 'main',
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
        'token.actions.githubusercontent.com:sub':
          'repo:Waney93LLC/djangoproject:*',
      },
    },
  };
}

function buildMigrationOpsConfig(
  scope: Construct,
  stage: Stage,
): ISharedServicesConfig['migrationOps'] {
  // ResourceConfigFacade is constructed here, where its resolved values
  // are needed — not inside the stack constructor.
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
        tagKey: 'Name',
        tagValue: 'waney93-bastion',
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
      name: 'waney93-pipeline-a-migration-storage',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketId: 'MigrationStorageBucket',
    },
  };
}
