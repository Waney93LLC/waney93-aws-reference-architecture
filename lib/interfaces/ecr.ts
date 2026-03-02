import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cdk from 'aws-cdk-lib';

/**
 * Encapsulates properties for configuring an ECR repository in the EcrConstruct.
 */
export interface EcrConstructProps {
  readonly repositoryName: string;
  readonly imageScanOnPush?: boolean;
  readonly imageTagMutability?: ecr.TagMutability;
  readonly encryption?: ecr.RepositoryEncryption;
  readonly lifecycleMaxImageAgeDays?: number;
  readonly removalPolicy?: cdk.RemovalPolicy;
}
