import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SharedServicesBuilder } from '../../builders/shared-services';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Waney93CicdObservabilityStackProps } from '../../interfaces/shared-services';
import { getEnvConfig } from '../../config/environment';
import { getWaney93PipelineConfig } from '../../config/pipelines/waney93';

/**
 * Waney93CicdObservabilityStack
 *
 * Purpose:
 *   This stack is creates the observability resources for the waney93-cicd pipeline.
 */
export class Waney93CicdObservabilityStack extends cdk.Stack {
  /**
   * Creates a new Waney93CicdObservabilityStack.
   * @param scope - The construct scope
   * @param id - The stack ID
   * @param props - The stack properties
   */
  constructor(
    scope: Construct,
    id: string,
    props: Waney93CicdObservabilityStackProps,
  ) {
    super(scope, id, props);
    const { stage } = props;
    const pipelineConfig = getWaney93PipelineConfig(this, stage);

    const config = getEnvConfig(stage);
    if (!config) {
      throw new Error(`No config found for stage: ${stage}`);
    }

    const emailNotification = ssm.StringParameter.valueForStringParameter(
      this,
      config.pipeline.notifications?.emailParameter || '',
    );
    if (!emailNotification) {
      throw new Error(`No email notification found for stage: ${stage}`);
    }

    const topic = new sns.Topic(this, 'CicdNotificationsTopic');
    topic.addSubscription(new subs.EmailSubscription(emailNotification));
   new SharedServicesBuilder(this, 'SharedServicesBuilder', {
     stage: props.stage,
     config: pipelineConfig.sharedServices,
   }).withObservability({
     routes: [
       {
         name: 'PipelineExecStateChanges',
         eventPattern: {
           source: ['aws.codepipeline'],
           detailType: ['CodePipeline Pipeline Execution State Change'],
           detail: {
             pipeline: [config.pipeline.name],
             state: ['FAILED', 'CANCELED', 'SUPERSEDED'],
           },
         },
         targets: [new targets.SnsTopic(topic)],
       },
     ],
   });
  }
}
