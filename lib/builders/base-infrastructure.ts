import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseInfrastructureBuilderProps } from '../interfaces/base-infrastructure';
import { Network } from '../constructs/network';

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

  public withNetwork(): this {
    this.network = new Network(this.scope, `${this.idPrefix}-Network`, {
      ...this.props.network,
    });
    return this;
  }

  /**
   * Optional: define CDK outputs in one place.
   */
  public outputs(): this {
    if (!this.network) throw new Error('Call withNetwork() before outputs().');
    new cdk.CfnOutput(this.scope, 'VpcId', { value: this.network.vpc.vpcId, exportName:'networkid' });

    return this;
  }
}