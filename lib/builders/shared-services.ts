import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import {
  EventRouterProps,
  SharedServicesBuilderProps,
} from '../interfaces/shared-services-old';
import { EcrConstruct } from '../constructs/ecr';
import { OidcCiRoleConstruct } from '../constructs/odic-ci-role';
import { EventRouter } from '../constructs/event-router';
import { OpsRunbookConstruct } from '../constructs/ops-runbook';
import { CognitoConstruct } from '../constructs/cognito/cognito-construct';
import { CognitoUserPoolConstruct } from '../constructs/cognito/cognito-userpool-constructs';
import { CognitoSecretsConstruct } from '../constructs/cognito/cognito-secrets-constructs';
import { S3StorageConstruct } from '../constructs/s3storage';
import { ResourceConfigFacade } from '../config/environment';

/**
 * SharedServicesBuilder
 *
 * Purpose:
 *   Composition layer that orchestrates one or more constructs into a cohesive
 *   feature (e.g., Cognito, VPC, ECS, CI/CD).
 *
 * Notes:
 *   - Apply defaults + normalize props here.
 *   - Keep public methods fluent (return this) to support chaining.
 */
export class SharedServicesBuilder {
  private readonly scope: Construct;
  private readonly idPrefix: string;
  private readonly props: Required<SharedServicesBuilderProps>;
  private repo?: EcrConstruct;
  private ciGithubEcrRoles?: iam.PolicyStatement[];
  private userPool?: CognitoUserPoolConstruct;
  private domainCert?: acm.ICertificate;
  private secrets?: CognitoSecretsConstruct;
  private migrationOpsRunbook?: OpsRunbookConstruct;
  private s3Construct?: S3StorageConstruct;

  /**
   * SharedServicesBuilder constructor creates a builder that orchestrates
   * one or more constructs into a cohesive feature.
   * @param scope - The construct scope
   * @param idPrefix - The ID prefix for the resources
   * @param props - The builder properties
   */
  constructor(
    scope: Construct,
    idPrefix: string,
    props: SharedServicesBuilderProps,
  ) {
    this.scope = scope;
    this.idPrefix = idPrefix;

    this.props = {
      ...props,
    } as Required<SharedServicesBuilderProps>;
  }

  /**
   * Configure the ECR repository.
   * @returns this
   */
  public withEcr(): this {
    if (!this.props.ecr) {
      throw new Error('ECR configuration is required to create ECR repository');
    }
    this.repo = new EcrConstruct(this.scope, 'EcrBuilder', {
      repositoryName: this.props.ecr.REPO_NAME,
      imageScanOnPush: this.props.ecr.ImageScanOnPush,
      imageTagMutability: this.props.ecr.ImageTagMutability,
      encryption: this.props.ecr.Encryption,
      lifecycleMaxImageAgeDays: this.props.ecr.LifecycleMaxImageAgeDays,
      removalPolicy: this.props.ecr.RemovalPolicy,
    });
    return this;
  }

  /**
   * Configure the CI/CD GitHub ECR push role.
   * @returns this
   */
  public withCiEcrPushRole(): this {
    if (!this.repo) {
      throw new Error(
        'ECR repository must be configured before creating CI/CD GitHub ECR push role',
      );
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
        resources: [`${this.repo?.repository.repositoryArn}`],
      }),
    ];
    return this;
  }

  /**
   * Configure a repository OIDC role for CI/CD.
   * @returns this
   */
  public withGitHubOidc(): this {
    if (!this.repo) {
      throw new Error(
        'ECR repository must be created before adding CI GitHub Role',
      );
    }
    if (!this.ciGithubEcrRoles) {
      throw new Error(
        'CI GitHub ECR roles must be defined before adding CI GitHub Role',
      );
    }
    if (!this.props.ecr) {
      throw new Error(
        'ECR configuration must be provided before adding CI GitHub Role',
      );
    }
    if (!this.props.oidc) {
      throw new Error(
        'OIDC configuration must be provided before adding CI GitHub Role',
      );
    }

    new OidcCiRoleConstruct(this.scope, 'GithubCiIdentity', {
      repoOrg: this.props.oidc.applicationRepository.owner,
      repoName: this.props.oidc.applicationRepository.name,
      provider: {
        name: this.props.oidc.provider.name,
        url: this.props.oidc.provider.url,
        clientIds: this.props.oidc.provider.clientIds,
        thumbprints: this.props.oidc.provider.thumbprints,
      },
      ciRole: {
        roleName: this.props.oidc.ciRole.name,
        description: this.props.oidc.ciRole.description,
        stringEquals: this.props.oidc.ciRole.stringEqualityConditions,

        stringLike: this.props.oidc.ciRole.stringLikeConditions,
        maxSessionDuration: cdk.Duration.hours(1),
      },
      ecr: { repo: this.repo.repository },
      roles: this.ciGithubEcrRoles,
    });
    return this;
  }

  /**
   * Create observability resources and integrate with event router.
   * @param routerProps
   * @returns this
   */
  public withObservability(routerProps: EventRouterProps): this {
    new EventRouter(this.scope, `${this.idPrefix}-Observability`, routerProps);
    return this;
  }

  /**
   * Add Ops Runbook construct to run SSM Automation when the specified stack is created.
   * @returns this
   */
  public withMigrationBootstrap(): this {
    if (!this.props.migrationOps) {
      throw new Error(
        'Migration Ops configuration is required to create Ops Runbook',
      );
    }
    if (!this.props.migrationStorage) {
      throw new Error(
        'Migration Storage configuration is required to create Ops Runbook with migration storage integration',
      );
    }
    this.migrationOpsRunbook = new OpsRunbookConstruct(
      this.scope,
      'MigrationBootstrapRunbook',
      {
        migrationOps: this.props.migrationOps,
        bucketName: this.props.migrationStorage.s3Bucket?.name,
      },
    );
    return this;
  }

  /**
   * Adds Cognito resources to the stack, including User Pool, custom domain with certificate, and secrets for user pool credentials.
   * @returns this
   */
  public withCognito(): this {
    if (!this.props.cognito) {
      throw new Error(
        'Cognito configuration is required to create Cognito resources',
      );
    }
    const cognitoConstruct = new CognitoConstruct(
      this.scope,
      'CognitoConstruct',
      {
        idPrefix: `${this.idPrefix}-Cognito`,
        cognito: this.props.cognito,
      },
    );
    this.userPool = cognitoConstruct.createUserPool();
    this.domainCert = cognitoConstruct.customDomainAndCert(this.userPool);
    this.secrets = cognitoConstruct.createSecrets(this.userPool);

    return this;
  }

  /**
   * Adds migration storage resources to the stack, such as S3 buckets or DynamoDB tables.
   * @returns this
   */
  public withMigrationStorage(): this {
    if (!this.props.migrationStorage) {
      throw new Error(
        'Migration Storage configuration is required to create migration storage resources',
      );
    }
    if (this.props.migrationStorage.s3Bucket) {
      this.s3Construct = new S3StorageConstruct(
        this.scope,
        'MigrationStorageBucket',
        this.props.migrationStorage.s3Bucket,
      );
    }
    return this;
  }

  /**
   * Optional: define CDK outputs in one place.
   */
  public outputs(): this {
    if (this.userPool) {
      new cdk.CfnOutput(this.scope, 'cognitoUserPoolId', {
        value: this.userPool.userPool.userPoolId,
        description: 'Cognito User Pool ID',
        exportName:
          ResourceConfigFacade.ExportedValueName.cognito?.userPoolId ||
          `${this.idPrefix}-CognitoUserPoolId`,
      });
    }
    if (this.domainCert) {
      new cdk.CfnOutput(this.scope, 'cognitoDomainCertArn', {
        value: this.domainCert.certificateArn,
        description: 'Cognito Custom Domain Certificate ARN',
        exportName:
          ResourceConfigFacade.ExportedValueName.cognito?.certificateArn ||
          `${this.idPrefix}-CognitoDomainCertArn`,
      });
    }
    if (this.s3Construct) {
      new cdk.CfnOutput(this.scope, 'migrationStorageBucketArn', {
        value: this.s3Construct.bucket.bucketArn,
        description: 'Migration Storage Bucket ARN',
        exportName:
          ResourceConfigFacade.ExportedValueName.storage
            ?.migrationStorageBucketArn ||
          `${this.idPrefix}-MigrationStorageBucketArn`,
      });
    }
    return this;
  }
}
