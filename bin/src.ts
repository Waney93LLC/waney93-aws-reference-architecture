import * as cdk from 'aws-cdk-lib/core';
import { Waney93CICDStack } from '../lib/stacks/cicd/waney93-cicd';
import { Waney93CicdObservabilityStack } from '../lib/stacks/cicd/waney93-cicd-observability';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage');

new Waney93CicdObservabilityStack(app, 'Waney93CicdObservabilityStack', {
  stage: stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,  
  },
});

new Waney93CICDStack(app, 'Waney93CICDStack', {
  stage: stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
