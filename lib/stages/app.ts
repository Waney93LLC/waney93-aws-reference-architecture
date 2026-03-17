import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppStageProps } from '../interfaces/app';
import { AppStack } from '../stacks/app';
import { getWaney93PipelineConfig } from '../config/pipelines/waney93';

/**
 * AppStage
 *
 * Purpose:
 *   Environment-specific entry point that instantiates stacks with the
 *   appropriate configuration.
 */
export class AppStage extends cdk.Stage {
  /**
   * AppStage constructor instantiates the AppStack.
   * @param scope - The construct scope
   * @param id - The stage ID
   * @param props - The stage properties
   */
  constructor(scope: Construct, id: string, props: AppStageProps) {
    super(scope, id, props);
    const config = getWaney93PipelineConfig(this, props.stage);

    new AppStack(this, 'PipelineA-App', {
      stage: props.stage,
      config: config.app,
      env: props.env,
    });
  }
}
