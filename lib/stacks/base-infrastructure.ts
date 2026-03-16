import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  BaseInfrastructureStackProps,
} from '../interfaces/base-infrastructure';
import { BaseInfrastructureBuilder } from '../builders/base-infrastructure';
import { Network } from '../constructs/network';

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

    const builder = new BaseInfrastructureBuilder(this, id, {
      stage: props.stage,
      network: props.config.network,
      exportNames: props.config.exportNames,
    })
      .withNetwork()
      .withRdsBastion(props.config.bastion)
      .withAppClientSecurityGroup()
      .withAuroraDB(props.config.rds)
      .outputs();

    cdk.Tags.of(this).add('ManagedBy', 'waney93-aws-reference-architecture');
  }
}
