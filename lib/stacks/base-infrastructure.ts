import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  BaseInfrastructureStackProps,
  NETWORK_CONFIG,
} from '../interfaces/base-infrastructure';
import { BaseInfrastructureBuilder } from '../builders/base-infrastructure';
import {
  RdsBastionConfig,
} from '../interfaces/bastion';
import { SharedServicesStack } from './shared-services';
import { Stage } from '../config/environment';
import { SsmParameterResolver } from '../config/ssm-parameter-resolver';
import { RdsConfig } from '../interfaces/rds';

/**
 * BaseInfrastructureStack
 *
 * Purpose:
 *   Stack entry point for the BaseInfrastructure feature area.
 *   Keep this thin; orchestration belongs in builders.
 */
export class BaseInfrastructureStack extends cdk.Stack {
  /**
   * BaseInfrastructureStack constructor that instantiates BaseInfrastructureBuilder
   * @param scope - The construct scope
   * @param id - The stack ID
   * @param props - The stack properties
   */
  constructor(
    scope: Construct,
    id: string,
    props: BaseInfrastructureStackProps,
  ) {
    super(scope, id, props);

    new BaseInfrastructureBuilder(this, 'BaseInfrastructureBuilder', {
      network: BaseInfrastructureStack.getNetworkConfig(this),
      stage: props.stage,
      rdsBastion: BaseInfrastructureStack.getBastionConfig(this),
      rds: BaseInfrastructureStack.getRdsConfig(this),
    })
      // .withNetwork()
      // .withRdsBastion()
      // .withAppClientSecurityGroup()
      // .withRds()
      // .outputs();

    // Optional tagging convention
    cdk.Tags.of(this).add('ManagedBy', 'waney93-aws-reference-architecture');
  }

  static getNetworkConfig(scope: Construct): NETWORK_CONFIG {
    return {
      maxAzs: 2,
      natGateways: 1,
      logGrp: new LogGroup(scope, 'VpcFlowLogs', {
        retention: RetentionDays.ONE_DAY,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // keep RETAIN in prod
      }),
      cidrMaskPrivate: 24,
      cidrMaskPublic: 24,
      idPrefix: 'BaseVpc',
    };
  }

  static getBastionConfig(scope: Construct): RdsBastionConfig {
    return {
      userDataCommands: [
        'set -eux',
        'sudo dnf -y update',
        'sudo dnf -y install --allowerasing curl postgresql17 python3 jq unzip',
      ],

      subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instance: {
        type: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
        ami: ec2.MachineImage.latestAmazonLinux2023(),
      },
      securityGroupPorts: [
        {
          port: ec2.Port.tcp(5432),
          description: 'Allow outbound access to databases',
        },
      ],
      config: SharedServicesStack.getMigrationOpsConfig(),
      parameterResolver: new SsmParameterResolver(scope),
    };
  }

  static getRdsConfig(scope: Construct): RdsConfig {
    return {
      name: 'django-rds-cluster',
      id: 'djangodbcluster',
      databaseName: 'djangodb',
      deletionProtection: false, // set to true for prod
      portRules: [
        {
          port: ec2.Port.tcp(5432),
          description: 'Allow ECS tasks to connect to Aurora Postgres',
        },
      ],
      parameterResolver: new SsmParameterResolver(scope),
    };

  }
}
