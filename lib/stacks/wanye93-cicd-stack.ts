import * as cdk from 'aws-cdk-lib';
import { Construct  } from 'constructs';
import * as pipeline from 'aws-cdk-lib/pipelines';
import { CodePipeline  } from 'aws-cdk-lib/aws-events-targets';



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

    // Define the CI/CD pipeline here
  }
}