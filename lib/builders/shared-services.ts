import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import {
  SharedServicesBuilderProps,
  ISharedServicesConfig,
} from '../interfaces/shared-services';
import { EcrConstruct } from '../constructs/ecr';
import { OidcCiRoleConstruct } from '../constructs/odic-ci-role';
import { CognitoConstruct } from '../constructs/cognito/cognito-construct';
import { CognitoUserPoolConstruct } from '../constructs/cognito/cognito-userpool-constructs';
import { CognitoSecretsConstruct } from '../constructs/cognito/cognito-secrets-constructs';
import { OpsRunbookConstruct } from '../constructs/ops-runbook';
import { S3StorageConstruct } from '../constructs/s3storage';
import { EventRouter } from '../constructs/event-router';
import {EventRouterProps} from '../interfaces/shared-services';

/**
 * SharedServicesBuilder
 *
 * Orchestrates shared service constructs into a cohesive feature.
 * This builder contains no configuration decisions — all decisions
 * are injected via ISharedServicesConfig.
 *
 * Optional features (migrationOps, cognito) are no-ops when their
 * config is absent. They never throw for missing optional config.
 */
export class SharedServicesBuilder {
  private readonly scope: Construct;
  private readonly idPrefix: string;
  private readonly config: ISharedServicesConfig;

  private repo?: EcrConstruct;
  private ciGithubEcrRoles?: iam.PolicyStatement[];
  private userPool?: CognitoUserPoolConstruct;
  private domainCert?: acm.ICertificate;
  private secrets?: CognitoSecretsConstruct;
  private migrationOpsRunbook?: OpsRunbookConstruct;
  private s3Construct?: S3StorageConstruct;

  constructor(
    scope: Construct,
    idPrefix: string,
    props: SharedServicesBuilderProps,
  ) {
    this.scope = scope;
    this.idPrefix = idPrefix;
    this.config = props.config;
  }

  /**
   * Creates the ECR repository.
   * Throws if ecr config is absent — ECR is not optional for this builder.
   */
  public withEcr(): this {
    this.repo = new EcrConstruct(this.scope, 'EcrBuilder', {
      repositoryName: this.config.ecr.repoName,
      imageScanOnPush: this.config.ecr.imageScanOnPush,
      imageTagMutability: this.config.ecr.imageTagMutability,
      encryption: this.config.ecr.encryption,
      lifecycleMaxImageAgeDays: this.config.ecr.lifecycleMaxImageAgeDays,
      removalPolicy: this.config.ecr.removalPolicy,
    });
    return this;
  }

  /**
   * Defines the IAM policy statements needed for CI/CD to push to ECR.
   * Must be called after withEcr().
   */
  public withCiEcrPushRole(): this {
    if (!this.repo) {
      throw new Error('Call withEcr() before withCiEcrPushRole().');
    }

    this.ciGithubEcrRoles = [
      new iam.PolicyStatement({
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
          'ecr:PutImage',
          'ecr:DescribeRepositories',
          'ecs:DescribeTaskDefinition',
          'ecs:ListTaskDefinitions',
          'ecs:RegisterTaskDefinition',
          'ecs:UpdateService',
          'iam:PassRole',
        ],
        resources: [this.repo.repository.repositoryArn],
      }),
    ];
    return this;
  }

  /**
   * Creates the GitHub OIDC provider and CI role.
   * Must be called after withEcr() and withCiEcrPushRole().
   */
  public withGitHubOidc(): this {
    if (!this.repo) {
      throw new Error('Call withEcr() before withGitHubOidc().');
    }
    if (!this.ciGithubEcrRoles) {
      throw new Error('Call withCiEcrPushRole() before withGitHubOidc().');
    }

    const { oidc } = this.config;

    new OidcCiRoleConstruct(this.scope, 'GithubCiIdentity', {
      repoOrg: oidc.applicationRepository.owner,
      repoName: oidc.applicationRepository.name,
      provider: {
        name: oidc.provider.name,
        url: oidc.provider.url,
        clientIds: oidc.provider.clientIds,
        thumbprints: oidc.provider.thumbprints,
      },
      ciRole: {
        roleName: oidc.ciRole.name,
        description: oidc.ciRole.description,
        stringEquals: oidc.ciRole.stringEqualityConditions,
        stringLike: oidc.ciRole.stringLikeConditions,
        maxSessionDuration: cdk.Duration.hours(1),
      },
      ecr: { repo: this.repo.repository },
      roles: this.ciGithubEcrRoles,
    });
    return this;
  }

  /**
   * Creates the EventBridge router for observability.
   */
  public withObservability(routerProps: EventRouterProps): this {
    new EventRouter(this.scope, `${this.idPrefix}-Observability`, routerProps);
    return this;
  }

  /**
   * Creates the SSM Automation runbook for migration bootstrap.
   * No-ops silently if migrationOps config is absent — not all pipelines
   * require migration automation.
   */
  public withMigrationBootstrap(): this {
    if (!this.config.migrationOps) {
      return this; // optional feature — no-op, no throw
    }
    if (!this.config.migrationStorage) {
      throw new Error(
        'migrationStorage config is required when migrationOps is provided.',
      );
    }

    this.migrationOpsRunbook = new OpsRunbookConstruct(
      this.scope,
      'MigrationBootstrapRunbook',
      {
        migrationOps: this.config.migrationOps,
        bucketName: this.config.migrationStorage.s3Bucket?.name,
      },
    );
    return this;
  }

  /**
   * Creates migration storage resources (S3 bucket, DynamoDB table).
   * No-ops silently if migrationStorage config is absent.
   */
  public withMigrationStorage(): this {
    if (!this.config.migrationStorage?.s3Bucket) {
      return this; // optional feature — no-op, no throw
    }

    this.s3Construct = new S3StorageConstruct(
      this.scope,
      'MigrationStorageBucket',
      this.config.migrationStorage.s3Bucket,
    );
    return this;
  }

  /**
   * Creates Cognito User Pool, custom domain, certificate, and secrets.
   * No-ops silently if cognito config is absent — not all pipelines
   * require Cognito.
   */
  public withCognito(): this {
    if (!this.config.cognito) {
      return this; // optional feature — no-op, no throw
    }

    const cognitoConstruct = new CognitoConstruct(
      this.scope,
      'CognitoConstruct',
      {
        idPrefix: `${this.idPrefix}-Cognito`,
        cognito: this.config.cognito,
      },
    );

    this.userPool = cognitoConstruct.createUserPool();
    this.domainCert = cognitoConstruct.customDomainAndCert(this.userPool);
    this.secrets = cognitoConstruct.createSecrets(this.userPool);

    return this;
  }

  /**
   * Emits CfnOutputs for constructed resources.
   * Export names are injected via config — no static fallbacks.
   */
  public outputs(): this {
    const names = this.config.exportNames;

    if (this.userPool && names?.cognitoUserPoolId) {
      new cdk.CfnOutput(this.scope, 'CognitoUserPoolId', {
        value: this.userPool.userPool.userPoolId,
        description: 'Cognito User Pool ID',
        exportName: names.cognitoUserPoolId,
      });
    }

    if (this.domainCert && names?.cognitoDomainCertArn) {
      new cdk.CfnOutput(this.scope, 'CognitoDomainCertArn', {
        value: this.domainCert.certificateArn,
        description: 'Cognito Custom Domain Certificate ARN',
        exportName: names.cognitoDomainCertArn,
      });
    }

    if (this.s3Construct && names?.migrationStorageBucketArn) {
      new cdk.CfnOutput(this.scope, 'MigrationStorageBucketArn', {
        value: this.s3Construct.bucket.bucketArn,
        description: 'Migration Storage Bucket ARN',
        exportName: names.migrationStorageBucketArn,
      });
    }

    return this;
  }
}
