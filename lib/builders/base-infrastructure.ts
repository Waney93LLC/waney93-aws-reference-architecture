import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseInfrastructureBuilderProps } from '../interfaces/base-infrastructure';
import { Network } from '../constructs/network';
import { RdsBastion } from '../constructs/bastion';
import { RdsBastionConfigBuilder } from './rds-bastion';
import { getExportedValueName } from '../config/environment';

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
      this.network.vpc,
    ).build();
    new RdsBastion(this.scope, `${this.idPrefix}-RdsBastion`, {
      vpc: this.network.vpc,
      ...bastionConfig,
    });
    return this;
  }

  /**
   * Adds a security group for application clients that need access to the network.
   * @returns The current instance of BaseInfrastructureBuilder for chaining.
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
   * Optional: define CDK outputs in one place.
   */
  public outputs(): this {
    if (!this.network) throw new Error('Call withNetwork() before outputs().');
    if(!this.appClientSg) throw new Error('Call withAppClientSecurityGroup() before outputs().');
    if (getExportedValueName().network) {
      new cdk.CfnOutput(this.scope, 'VpcId', {
        value: this.network.vpc.vpcId,
        exportName: getExportedValueName().network?.vpcId,
      });
    }
    if (getExportedValueName().network) {
      new cdk.CfnOutput(this.scope, 'AppClientSgId', {
        value: this.appClientSg.securityGroupId,
        exportName: getExportedValueName().network?.appClientSgId,
      });
    }
    return this;
  }
}