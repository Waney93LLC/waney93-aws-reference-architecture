import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';
import { IBaseInfrastructureConfig } from '../../interfaces/base-infrastructure';
import { Stage } from '../environment';
import { SsmParameterResolver } from '../ssm-parameter-resolver';

/**
 * getPipelineAConfig
 *
 * Purpose: Provides the concrete infrastructure configuration for Pipeline A.
 * This function is the only place Pipeline A's infrastructure decisions live —
 * instance sizes, CIDR ranges, port rules, retention policies, etc.
 *
 * Rules:
 * - This function describes intent. It does NOT create CDK resources.
 * - Security groups, roles, and VPCs are created by constructs, not here.
 * - CDK tokens (Fn.importValue) are allowed — they are lazy references,
 *   not resource construction.
 */
export function getPipelineAConfig(
  scope: Construct,
  stage: Stage,
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

// ─── Network ────────────────────────────────────────────────────────────────

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

// ─── Bastion ─────────────────────────────────────────────────────────────────

function buildBastionConfig(): IBaseInfrastructureConfig['bastion'] {
  return {
    instance: buildBastionInstanceConfig(),
    // Port rules only — the security group resource is created inside
    // BastionSecurityGroup using the VPC the builder already holds.
    securityGroup: {
      portRules: [
        {
          port: ec2.Port.tcp(5432),
          description: 'Allow outbound access to Aurora Postgres',
        },
      ],
    },
    runCommandDocumentName: 'AWS-RunShellScript',
    migrationStorage: {
      migrationStorageBucketExportName:
        'pipeline-a-migration-storage-bucket-name',
    },
    // roleProvider is omitted — RdsBastion defaults to BastionIamRole internally.
    // BastionIamRole owns role creation and policy attachment.
    // Only provide roleProvider here if you need to override the default role.
  };
}

function buildBastionInstanceConfig(): IBaseInfrastructureConfig['bastion']['instance'] {
  // UserData is constructed correctly — forLinux() first, then addCommands().
  // ec2.UserData.arguments is a JavaScript built-in, not a CDK method.
  const userData = ec2.UserData.forLinux();
  userData.addCommands(
    'set -eux',
    'sudo dnf -y update',
    'sudo dnf -y install --allowerasing curl postgresql17 python3 jq unzip',
  );

  return {
    type: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
    ami: ec2.MachineImage.latestAmazonLinux2023(),
    userData,
    detailedMonitoring: false, // opt-in, not hardcoded — set true for prod
    tagKey: 'Name',
    tagValue: 'pipeline-a-bastion',
  };
}

// ─── RDS ─────────────────────────────────────────────────────────────────────

function buildRdsConfig(scope: Construct): IBaseInfrastructureConfig['rds'] {
  return {
    name: 'django-rds-cluster',
    id: 'djangodbcluster',
    databaseName: 'djangodb',
    deletionProtection: false, // set true for prod
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
