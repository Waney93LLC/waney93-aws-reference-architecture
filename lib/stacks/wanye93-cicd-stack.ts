import * as cdk from 'aws-cdk-lib';
import { Construct  } from 'constructs';
import * as pipeline from 'aws-cdk-lib/pipelines';
import { CodePipeline  } from 'aws-cdk-lib/aws-events-targets';
import { getConfig } from '../config/environment-config';
import * as ssm from 'aws-cdk-lib/aws-ssm';



/**
 * Wanye93CICDStack
 *
 * Purpose:
 *   Stack entry point for the Wanye93 CI/CD pipeline.
 */
export class Wanye93CICDStack extends cdk.Stack {

  /**
   * Wanye93CICDStack constructor that instantiates the pipeline construct.
   * Note: the pipeline construct requires the followings:
   * - A pipeline name
   * - A repo description (repo owner, repo name, and branch)
   * - A CodestarConnection ARN
   * @param scope - The construct scope
   * @param id - The stack ID
   * @param props - The stack properties
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const stage = scope.node.tryGetContext('stage');
    const config = getConfig(stage);
    if (!config) {
      throw new Error(`No config found for stage: ${stage}`);
    }
    const connectionArn = ssm.StringParameter.valueForStringParameter(this, config.pipeline.codestar.connectionArnParameter);
    if (!connectionArn) {
      throw new Error(`No CodestarConnection ARN found for stage: ${stage}`);
    }
    const { pipeline } = config;
    if (!pipeline.name) {
      throw new Error(`No pipeline name found for stage: ${stage}`);
    }
    if (!pipeline.repository.owner || !pipeline.repository.name || !pipeline.repository.branch) {
      throw new Error(`Incomplete repository information found for stage: ${stage}`);
    }

    // Define the CI/CD pipeline here
  }
}