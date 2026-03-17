import * as cdk from 'aws-cdk-lib/core';
import { Waney93CICDStack } from '../lib/stacks/cicd/waney93-cicd';
import { Waney93CicdObservabilityStack } from '../lib/stacks/cicd/waney93-cicd-observability';
import { FoundationsStage } from '../lib/stages/foundations';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage');

new Waney93CicdObservabilityStack(app, 'Waney93CicdObservabilityStack', {
  stage: stage,
  description: 'Observability stack for Waney93 CI/CD pipeline',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const waney93CICDStack = new Waney93CICDStack(app, 'Waney93CICDStack', {
  stage: stage,
  description: 'CI/CD pipeline stack for Waney93 AWS Reference Architecture',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const foundationsWave = waney93CICDStack.pipeline.addWave(
  `${stage}-Foundations`,
);
const sharedStage = new FoundationsStage(
  app,
  `${stage}-SharedServices`,
  {
    env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
    stage: stage,
  },
);

if (process.env.SKIP_FOUNDATIONS !== 'true') {
  foundationsWave.addStage(sharedStage);
}