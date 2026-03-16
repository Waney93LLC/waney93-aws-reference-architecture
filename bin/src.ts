import * as cdk from 'aws-cdk-lib/core';
import { Waney93CICDStack } from '../lib/stacks/cicd/waney93-cicd';
import { Waney93CicdObservabilityStack } from '../lib/stacks/cicd/waney93-cicd-observability';
import { getWaney93PipelineAConfig } from '../lib/config/pipelines/waney93';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage');
const pipelineConfig = getWaney93PipelineAConfig(app, stage);

new Waney93CicdObservabilityStack(app, 'Waney93CicdObservabilityStack', {
  stage: stage,
  config: pipelineConfig.sharedServices,
  description: 'Observability stack for Waney93 CI/CD pipeline',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new Waney93CICDStack(app, 'Waney93CICDStack', {
  stage: stage,
  config: pipelineConfig,
  description: 'CI/CD pipeline stack for Waney93 AWS Reference Architecture',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
