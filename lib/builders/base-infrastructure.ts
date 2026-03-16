import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseInfrastructureProps } from '../interfaces/base-infrastructure';
import { Network } from '../constructs/network';
import { RdsBastion } from '../constructs/rds-bastion/rds-bastion';
import {
  getResourceParameterConfig,
  ResourceConfigFacade,
  Stage,
} from '../config/environment';
import { AuroraDB } from '../constructs/rds/aurora';
import {
  IParameterResolver,
  ResolvedDatabaseCredentials,
} from '../interfaces/parameter-resolver';
import { AuroraDbConfig, RdsBastionConfig } from '../interfaces/bastion';
import {
  IRdsAppUserConfig,
  IRdsClusterConfig,
  IRdsIngressSource,
} from '../interfaces/rds';

/**
 * BaseInfrastructureBuilder
 *
 * Purpose:
 *   Composition layer that orchestrates one or more constructs into a cohesive
 *   feature (e.g., Cognito, VPC, ECS, CI/CD).
 *
 * Notes:
 *   - Apply defaults + normalize props here.
 *   - Keep public methods fluent (return this) to support chaining.
 */
export class BaseInfrastructureBuilder {
  public network?: Network;
  private resolvedCredentials?: ResolvedDatabaseCredentials;

  private appClientSg?: ec2.SecurityGroup;
  private bastion?: RdsBastion;

  /**
   * BaseInfrastructureBuilder constructor creates a builder that orchestrates
   * one or more constructs into a cohesive feature.
   * @param scope - The construct scope
   * @param idPrefix - The ID prefix for the resources
   * @param props - The builder properties
   */
  constructor(
    readonly scope: Construct,
    readonly idPrefix: string,
    readonly props: BaseInfrastructureProps,
  ) {}

  /**
   * withNetwork adds a VPC and related network resources to the builder.
   */
  public withNetwork(): this {
    this.network = new Network(this.scope, `${this.idPrefix}-Network`, {
      ...this.props.network,
    });
    return this;
  }

  /**
   * withRdsBastion adds a bastion host for RDS access to the builder.
   */
  public withRdsBastion(config: RdsBastionConfig): this {
    if (!this.network) {
      throw new Error('withNetwork() must be called before withRdsBastion().');
    }

    this.bastion = new RdsBastion(this.scope, `${this.idPrefix}-RdsBastion`, {
      network: { vpc: this.network.vpc },
      ...config,
    });

    return this;
  }
  /**
   * Adds a security group for application clients that need access to the network.
   */
  public withAppClientSecurityGroup(): this {
    if (!this.network)
      throw new Error(
        'Call withNetwork() before withAppClientSecurityGroup().',
      );

    this.appClientSg = new ec2.SecurityGroup(this.scope, 'AppClientSg', {
      vpc: this.network.vpc,
      description:
        'Shared SG for app workloads that need access to the network (e.g., ECS tasks, Lambda functions)',
      allowAllOutbound: true,
    });
    return this;
  }

  public withAuroraDB(config: AuroraDbConfig): this {
    if (!this.network)
      throw new Error('Call withNetwork() before withAuroraDB().');
    if (!this.bastion)
      throw new Error('Call withRdsBastion() before withAuroraDB().');
    if (!this.appClientSg)
      throw new Error(
        'Call withAppClientSecurityGroup() before withAuroraDB().',
      );

    const credentials = this.getRdsClusterConfig(
      config.parameterResolver,
      this.props.stage,
    );

    new AuroraDB(this.scope, `${this.idPrefix}-Data`, {
      network: { vpc: this.network.vpc },
      ingressSources: this.buildRdsIngressSources(config),
      cluster: this.buildRdsClusterConfig(config, credentials),
      appUser: this.buildRdsAppUserConfig(credentials),
    });

    return this;
  }

  private buildRdsIngressSources(config: AuroraDbConfig): IRdsIngressSource[] {
    return [
      {
        securityGroup: this.bastion!.securityGroup,
        portRules: config.bastionPortRules,
      },
      {
        securityGroup: this.appClientSg!,
        portRules: config.appClientPortRules,
      },
    ];
  }

  private buildRdsClusterConfig(
    config: AuroraDbConfig,
    credentials: ResolvedDatabaseCredentials,
  ): IRdsClusterConfig {
    return {
      id: config.id,
      name: config.name,
      databaseName: config.databaseName,
      deletionProtection: config.deletionProtection,
      capacity: config.capacity,
      readers: config.readers,
      admin: {
        username: credentials.adminUsername,
        secretName: credentials.loginSecretName,
      },
    };
  }

  private buildRdsAppUserConfig(
    credentials: ResolvedDatabaseCredentials,
  ): IRdsAppUserConfig {
    return {
      username: credentials.appUserName,
      secretName: credentials.appUserSecretName,
    };
  }

  private getRdsClusterConfig(
    parameterResolver: IParameterResolver,
    stage: Stage,
  ): ResolvedDatabaseCredentials {
    const resourceConfig = new ResourceConfigFacade(
      parameterResolver,
      getResourceParameterConfig(stage),
    );
    return resourceConfig.getDatabaseCredentials();
  }

  /**
   * Optional: define CDK outputs in one place.
   */
  public outputs(): this {
    if (this.network && this.props.exportNames?.vpcId) {
      new cdk.CfnOutput(this.scope, 'VpcId', {
        value: this.network.vpc.vpcId,
        exportName: this.props.exportNames.vpcId,
      });
    }
    if (this.appClientSg && this.props.exportNames?.appClientSgId) {
      new cdk.CfnOutput(this.scope, 'AppClientSgId', {
        value: this.appClientSg.securityGroupId,
        exportName: this.props.exportNames.appClientSgId,
      });
    }
    return this;
  }
}
