import * as cdk from 'aws-cdk-lib';
import { Stage } from '../config/environment';

export interface ISharedServicesConfig {
  ecr: EcrConfig;
  oidc: OidcConfig;
  migrationOps?: MigrationOpsConfig; // optional — not all pipelines need it
  cognito?: CognitoConfig; // optional — not all pipelines need it
  migrationStorage: MigrationStorageConfig;
}

export interface EcrConfig {
  repoName: string;
  imageScanOnPush: boolean;
  imageTagMutability: cdk.aws_ecr.TagMutability;
  encryption: cdk.aws_ecr.RepositoryEncryption;
  lifecycleMaxImageAgeDays: number;
  removalPolicy: cdk.RemovalPolicy;
}

export interface OidcConfig {
  applicationRepository: {
    owner: string;
    name: string;
    branch: string;
  };
  provider: {
    name: string;
    url: string;
    clientIds: string[];
    thumbprints: string[];
  };
  ciRole: {
    name: string;
    description: string;
    stringEqualityConditions: Record<string, string>;
    stringLikeConditions: Record<string, string>;
  };
}

export interface MigrationOpsConfig {
  automationRunbookName: string;
  runCommandDocumentName: string;
  target: {
    instance: {
      tagKey: string;
      tagValue: string;
    };
  };
  script?: {
    folderPath: string;
    entryFile: string;
    description?: string;
  };
}

export interface CognitoConfig {
  app: {
    name: string;
    callbackUrls: string[];
    logoutUrls: string[];
    secret: { name: string };
  };
  customDomainName: string;
  acmCertificateArn: string;
  userPoolSelfSignUpEnabled: boolean;
  allowUsernameSignIn: boolean;
  removalPolicy: cdk.RemovalPolicy;
}

export interface MigrationStorageConfig {
  s3Bucket: {
    name: string;
    removalPolicy: cdk.RemovalPolicy;
    autoDeleteObjects: boolean;
    bucketId: string;
  };
}

export interface SharedServicesStackProps extends cdk.StackProps {
  stage: Stage;
  config: ISharedServicesConfig; 
}