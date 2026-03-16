import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as events from 'aws-cdk-lib/aws-events';
import { Stage } from '../config/environment';

export interface EcrConfig {
  repoName: string;
  imageScanOnPush: boolean;
  imageTagMutability: ecr.TagMutability;
  encryption: ecr.RepositoryEncryption;
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

export interface S3StorageConstructProps {
  name: string;
  removalPolicy: cdk.RemovalPolicy;
  autoDeleteObjects: boolean;
  bucketId: string;
  enforceSSL?: boolean;
  versioned?: boolean;
  encryption?: cdk.aws_s3.BucketEncryption;
}

export interface DynamoDBTableConstructProps {
  name: string;
  removalPolicy: cdk.RemovalPolicy;
  tableId: string;
}

export interface MigrationStorageConfig {
  s3Bucket?: S3StorageConstructProps;
  dynamoDBTable?: DynamoDBTableConstructProps;
}

// Export names are injected — no static fallbacks, no magic strings.
export interface SharedServicesExportNames {
  cognitoUserPoolId?: string;
  cognitoDomainCertArn?: string;
  migrationStorageBucketArn?: string;
}

// The single config contract the stack and builder depend on.
export interface ISharedServicesConfig {
  ecr: EcrConfig;
  oidc: OidcConfig;
  migrationOps?: MigrationOpsConfig; // optional — no-op if absent
  cognito?: CognitoConfig; // optional — no-op if absent
  migrationStorage: MigrationStorageConfig;
  exportNames?: SharedServicesExportNames;
}

// Builder props — no empty extension, stage lives here alongside config.
export interface SharedServicesBuilderProps {
  stage: Stage;
  config: ISharedServicesConfig;
}

// Stack props — slim, no feature flags.
export interface SharedServicesStackProps extends cdk.StackProps {
  stage: Stage;
  config: ISharedServicesConfig;
}

export interface EventRoute {
  readonly name: string;
  readonly eventBus?: events.IEventBus;
  readonly eventPattern: events.EventPattern;
  readonly targets: events.IRuleTarget[];
  readonly input?: events.RuleTargetInput;
  readonly enabled?: boolean;
}

export interface EventRouterProps {
  readonly routes: EventRoute[];
}

export interface OpsRunbookConstructProps {
  migrationOps: MigrationOpsConfig; // required here — caller guards before passing
  bucketName?: string;
}
