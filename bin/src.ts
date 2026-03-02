import * as cdk from 'aws-cdk-lib/core';
import { Wanye93CICDStack } from '../lib/stacks/cicd/wanye93-cicd-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage');

new Wanye93CICDStack(app, 'Wanye93CICDStack', {
  stage: stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,  
  },
});
