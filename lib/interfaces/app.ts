// interfaces/app.ts

import * as cdk from 'aws-cdk-lib';
import { Stage } from '../config/environment';

export interface AppEcsConfig {
  apiCertArn: string;
  imageTag: string;
  alertEmailAddress: string;
}

export interface AppCognitoConfig {
  certArn: string;
  appClientName: string; // used as the OIDC secret name
}

// The single contract AppStack depends on.
// All values are resolved before reaching the stack.
export interface IAppConfig {
  ecsConfig: AppEcsConfig;
  cognitoConfig: AppCognitoConfig;
  ecrRepoName: string;
}

export interface AppStackProps extends cdk.StackProps {
  stage: Stage;
  config: IAppConfig;
}

export interface AppStageProps extends cdk.StageProps {
  stage: Stage;
}
