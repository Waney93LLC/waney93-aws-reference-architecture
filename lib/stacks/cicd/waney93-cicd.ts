import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipeline from 'aws-cdk-lib/pipelines';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Waney93CICDStackProps } from './cicd-stack-props';
import { PipelineConstruct } from '../../constructs/pipeline';
import { FoundationsStage } from '../../stages/foundations';
import { AppStage } from '../../stages/app';
import { getWaney93PipelineConfig } from '../../config/pipelines/waney93';
import { CodePipeline } from 'aws-cdk-lib/pipelines';

/**
 * Waney93CICDStack
 *
 * Purpose:
 *   Stack entry point for the Waney93 CI/CD pipeline.
 */
export class Waney93CICDStack extends cdk.Stack {
  public pipeline: CodePipeline;
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
  constructor(scope: Construct, id: string, props: Waney93CICDStackProps) {
    super(scope, id, props);
    const { stage, env } = props;
    const config = getWaney93PipelineConfig(this, stage);

    if (!config) {
      throw new Error(`No config found for stage: ${stage}`);
    }
    const connectionArn = ssm.StringParameter.valueForStringParameter(
      this,
      config.envConfig.pipeline.codestar.connectionArnParameter,
    );
    if (!connectionArn) {
      throw new Error(`No CodestarConnection ARN found for stage: ${stage}`);
    }
    const { pipeline } = config.envConfig;
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
        `cdk synth -c stage=${stage} -c SKIP_FOUNDATIONS=${pipeline.skip_foundations}`,
      ],
    });

    // The Foundations wave bootstraps the AWS environment for a new application
    // or account onboarding. This wave is typically executed only once per
    // environment and provisions shared platform services that other stages
    // depend on.
    //
    // Examples of foundational services include:
    // - Identity and authentication (Cognito)
    // - Container registry (ECR)
    // - CI/CD identity federation (GitHub OIDC)
    // - Other shared account-level services
    //
    // It may also provision baseline infrastructure required by the application
    // environment such as networking (VPC), database clusters, a database
    // management bastion host, and optional migration tooling (e.g., AWS DMS).
    //
    // Because these resources establish long-lived infrastructure for the
    // environment, a manual approval step is required before execution.
    // const foundationsWave = pipelineConstruct.pipeline.addWave(
    //   `${stage}-Foundations`,
    //   {
    //     pre: [
    //       new cdk.pipelines.ManualApprovalStep('Approve-first-wave', {
    //         comment: 'Approve deployment of the first wave.',
    //       }),
    //     ],
    //   },
    // );

      

    const foundationsWave = pipelineConstruct.pipeline.addWave(stage);
    const sharedStage = new FoundationsStage(
      pipelineConstruct.pipeline,
      `${stage}-SharedServices`,
      {
        env: env,
        stage: props.stage,
      },
    );

    if (process.env.SKIP_FOUNDATIONS !== 'true') {
      foundationsWave.addStage(sharedStage);
    }

    // const appWave = this.pipeline.addWave(`${stage}-App`);
    // const appStage = new AppStage(
    //   this.pipeline,
    //   `${stage}-AppStage`,
    //   {
    //     env: env,
    //     stage,
    //   },
    // );
    // appWave.addStage(appStage);
      cdk.Tags.of(this).add('ManagedBy', 'waney93-aws-reference-architecture');
  }
}
