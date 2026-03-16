import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBaseInfrastructureConfig } from './base-infrastructure';
import { ISharedServicesConfig } from './shared-services';
import { Stage } from '../config/environment';

/**
 * PipelineConstructProps defines the properties required to configure the reusable PipelineConstruct.
 */
export interface PipelineConstructProps {
  readonly pipelineId: string;
  readonly pipelineName: string;

  readonly repoOwner: string;
  readonly repoName: string;
  readonly branch?: string;
  readonly artifactBucket?: s3.IBucket;

  readonly codestarConnectionArn: string;

  /**
   * Optional: extra synth commands for specialization
   */
  readonly synthCommands: string[];

  /**
   * Optional: additional policy statements for the Synth step role
   */
  readonly synthRolePolicyStatements?: PolicyStatement[];
}

export interface PipelineAConfig {
  baseInfrastructure: IBaseInfrastructureConfig;
  sharedServices: ISharedServicesConfig;
}

export interface FoundationStageProps{
  stage: Stage;
  env?: cdk.Environment;
}