import * as cdk from 'aws-cdk-lib/core';
import { Wanye93CICDStack } from '../lib/stacks/wanye93-cicd-stack';

const app = new cdk.App();

new Wanye93CICDStack(app, 'Wanye93CICDStack');
