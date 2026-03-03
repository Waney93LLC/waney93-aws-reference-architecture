import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipeline from 'aws-cdk-lib/pipelines';
import { getEnvConfig } from '../../config/environment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CICDStackProps } from './cicd-stack-props';
import { PipelineConstruct } from '../../constructs/pipeline';
import { SharedServicesStage } from '../../stages/shared-services';

/**
 * Waney93CICDStack
 *
 * Purpose:
 *   Stack entry point for the Waney93 CI/CD pipeline.
 */
export class Waney93CICDStack extends cdk.Stack {
  /**
   * Waney93CICDStack constructor that instantiates the pipeline construct.
   * Note: the pipeline construct requires the followings:
   * - A pipeline name
   * - A repo description (repo owner, repo name, and branch)
   * - A CodestarConnection ARN
   * @param scope - The construct scope
   * @param id - The stack ID
   * @param props - The stack properties
   */
  constructor(scope: Construct, id: string, props: CICDStackProps) {
    super(scope, id, props);
    const { stage, env } = props;

    const config = getEnvConfig(stage);
    if (!config) {
      throw new Error(`No config found for stage: ${stage}`);
    }
    const connectionArn = ssm.StringParameter.valueForStringParameter(
      this,
      config.pipeline.codestar.connectionArnParameter,
    );
    if (!connectionArn) {
      throw new Error(`No CodestarConnection ARN found for stage: ${stage}`);
    }
    const acmCertificateArn = ssm.StringParameter.valueForStringParameter(
      this,
      config.cognito?.acmCertificateArnParameter || '',
    );
    const { pipeline } = config;
    if (!pipeline.name) {
      throw new Error(`No pipeline name found for stage: ${stage}`);
    }
    if (
      !pipeline.repository.owner ||
      !pipeline.repository.name ||
      !pipeline.repository.branch
    ) {
      throw new Error(
        `Incomplete repository information found for stage: ${stage}`,
      );
    }

    const pipelineConstruct = new PipelineConstruct(this, 'PipelineConstruct', {
      pipelineId: 'cicd-pipeline',
      pipelineName: pipeline.name,
      repoOwner: pipeline.repository.owner,
      repoName: pipeline.repository.name,
      branch: pipeline.repository.branch,
      codestarConnectionArn: connectionArn,
      synthCommands: [
        'npm ci',
        'npm install -g aws-cdk@latest',
        `cdk synth -c stage=${stage}`,
      ],
    });

    const initialWave = pipelineConstruct.pipeline.addWave(stage, {
      pre: [
        new cdk.pipelines.ManualApprovalStep('Approve-first-wave', {
          comment: 'Approve deployment of the first wave.',
        }),
      ],
    });
    const sharedStage = new SharedServicesStage(this, `${stage}-SharedServices`, {
      env: env,
      pipelineName: pipeline.name,
      acmCertificateArn,
    });
    initialWave.addStage(sharedStage);
    
  }
}
