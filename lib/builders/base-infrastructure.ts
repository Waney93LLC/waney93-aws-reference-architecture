import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseInfrastructureBuilderProps } from '../interfaces/base-infrastructure';
import { Network } from '../constructs/network';
import { RdsBastion } from '../constructs/bastion';
import { RdsBastionConfigBuilder } from './rds-bastion';
import {
  getResourceParameterConfig,
  ResourceConfigFacade,
  Stage,
} from '../config/environment';
import { Rds } from '../constructs/rds';
import { SecurityGroupConfig } from '../interfaces/common';
import {
  IParameterResolver,
  ResolvedDatabaseCredentials,
} from '../interfaces/parameter-resolver';

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
  private readonly scope: Construct;
  private readonly idPrefix: string;
  private readonly props: Required<BaseInfrastructureBuilderProps>;
  private network?: Network;
  private appClientSg?: ec2.SecurityGroup;
  private data?: Rds;
  private bastion?: RdsBastion;

  /**
   * BaseInfrastructureBuilder constructor creates a builder that orchestrates
   * one or more constructs into a cohesive feature.
   * @param scope - The construct scope
   * @param idPrefix - The ID prefix for the resources
   * @param props - The builder properties
   */
  constructor(
    scope: Construct,
    idPrefix: string,
    props: BaseInfrastructureBuilderProps,
  ) {
    this.scope = scope;
    this.idPrefix = idPrefix;

    this.props = {
      ...props,
    } as Required<BaseInfrastructureBuilderProps>;
  }

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
  public withRdsBastion(): this {
    if (!this.network)
      throw new Error('Call withNetwork() before withRdsBastion().');
    if (!this.props.rdsBastion)
      throw new Error(
        'rdsBastion config is required to create RdsBastion construct.',
      );
    const bastionConfig = new RdsBastionConfigBuilder(
      this.scope,
      this.props.rdsBastion,
      this.props.stage,
      this.network.vpc,
    ).build();
    this.bastion = new RdsBastion(this.scope, `${this.idPrefix}-RdsBastion`, {
      vpc: this.network.vpc,
      ...bastionConfig,
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

  /**
   * Adds an RDS cluster and related resources to the builder.
   * The security group has two seats - one for the bastion and one for an app client.
   */
  public withRds(): this {
    if (!this.props.rds)
      throw new Error('withRds is called with rds property not configured.');
    if (!this.network) throw new Error('Call withNetwork() before withRds().');
    if (!this.bastion) throw new Error('Call withBastion() before withRds().');
    if (!this.appClientSg)
      throw new Error('Call withAppClientSecurityGroup() before withRds().');
    const bastionSecGrpConfig: SecurityGroupConfig = {
      portRules: this.props.rdsBastion.securityGroupPorts,
      definition: this.bastion.securityGroup,
    };
    const appClientSecurityGroup: SecurityGroupConfig = {
      portRules: this.props.rds.portRules,
      definition: this.appClientSg,
    };
    const dbCredentials = this.getRdsClusterConfig(
      this.props.rds.parameterResolver,
      this.props.stage,
    );
    const clusterConfig = {
      name: this.props.rds.name,
      id: this.props.rds.id,
      databaseName: this.props.rds.databaseName,
      deletionProtection: this.props.rds.deletionProtection,
      admin: {
        username: dbCredentials.adminUsername,
        secretName: dbCredentials.loginSecretName,
      },
      app: {
        username: dbCredentials.appUserName,
        secretName: dbCredentials.appUserSecretName,
      },
    };

    this.data = new Rds(this.scope, `${this.idPrefix}-Data`, {
      vpc: this.network.vpc,
      secGrpConfigs: [bastionSecGrpConfig, appClientSecurityGroup],
      clusterConfig,
      ...this.props.rds,
    });

    return this;
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
    if (this.network) {
      new cdk.CfnOutput(this.scope, 'VpcId', {
        value: this.network.vpc.vpcId,
        exportName: ResourceConfigFacade.ExportedValueName.network?.vpcId || 'vpc_id',
      });
    }
    if (this.appClientSg) {
      new cdk.CfnOutput(this.scope, 'AppClientSgId', {
        value: this.appClientSg.securityGroupId,
        exportName: ResourceConfigFacade.ExportedValueName.network?.appClientSgId || 'app_client_sg_id',
      });
    }
    return this;
  }
}
