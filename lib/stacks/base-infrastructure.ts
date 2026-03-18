import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  BaseInfrastructureStackProps,
} from '../interfaces/base-infrastructure';
import { BaseInfrastructureBuilder } from '../builders/base-infrastructure';
import { getWaney93PipelineConfig } from '../config/pipelines/waney93';

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
    const config = getWaney93PipelineConfig(this, props.stage);
    

    // new BaseInfrastructureBuilder(this, id, {
    //   stage: props.stage,
    //   pipelineName: config.baseInfrastructure.pipeline.name,
    //   network: config.baseInfrastructure.network,
    //   exportNames: config.baseInfrastructure.exportNames,
    // })
      // .withNetwork()
      // .withRdsBastion(config.baseInfrastructure.bastion)
      // .withAppClientSecurityGroup()
      // .withAuroraDB(config.baseInfrastructure.rds)
      // .outputs();
  }
}
