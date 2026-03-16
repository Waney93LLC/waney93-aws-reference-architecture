import * as cdk from 'aws-cdk-lib';
import { CognitoConfig } from './shared-services';


/**
 * Encapsulates all Cognito-related configuration options for the SharedServices feature.
 */
export interface DjangoCognitoStackProps extends cdk.StackProps {
  appName: string;
  selfSignUpEnabled?: boolean;
  allowUsernameSignIn?: boolean;
  callbackUrls: string[];
  logoutUrls: string[];
  customDomainName: string;
  removalPolicy?: cdk.RemovalPolicy;
  secretName?: string;
  acmCertificateArn?: string;
}

/**
 * Encapsulates all properties required to create a Cognito User Pool and related resources for the CognitoUserPoolConstruct.
 */
export interface CognitoUserPoolConstructProps {
  appName: string;
  removalPolicy: cdk.RemovalPolicy;
  userPoolSelfSignUpEnabled: boolean;
  allowUsernameSignIn: boolean;
  callbackUrls: string[];
  logoutUrls: string[];
}

/**
 * Encapsulates all properties required to create a Cognito User Pool Client and related resources for the CognitoUserPoolClientConstruct.
 */
export interface CognitoSecretsConstructProps {
  secretName: string;
  userPoolId: string;
  userPoolClientId: string;
  userPoolClientName?: string;
  customDomainName: string;
  region: string;
}

export interface CognitoConstructProps {
  idPrefix?: string;
  cognito?: CognitoConfig;
}
