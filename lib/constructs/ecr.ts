import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { EcrConstructProps } from '../interfaces/ecr';

/**
 * ECR Construct that creates an ECR repository with specified properties.
 */
export class EcrConstruct extends Construct {
  public readonly repository: ecr.Repository;
  public readonly repositoryUri: string;

  /**
   * Creates an ECR repository with the given properties.
   * @param scope - The construct scope
   * @param id - The construct ID
   * @param props - The properties for the ECR repository
   */
  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: props.repositoryName.toLowerCase(),
      imageScanOnPush: props.imageScanOnPush ?? true,
      imageTagMutability:
        props.imageTagMutability ?? ecr.TagMutability.IMMUTABLE,
      encryption: props.encryption ?? ecr.RepositoryEncryption.KMS,
      lifecycleRules: [
        {
          description: 'Expire untagged images',
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: cdk.Duration.days(props.lifecycleMaxImageAgeDays ?? 2),
        },
      ],
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    this.repositoryUri = this.repository.repositoryUri;
  }
}
