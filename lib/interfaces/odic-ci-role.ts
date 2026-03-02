import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Encapsulates the properties required to create an OIDC CI/CD role for GitHub Actions. This includes the OIDC provider configuration, the role properties, and optional ECR repository permissions. This construct is designed to be generic and reusable for other CI/CD providers as well.
 */
export type OidcCiRoleConstructProps = {
  repoOrg: string;
  repoName: string;
  provider: {
    url: string;
    clientIds: string[];
    thumbprints: string[];
    name: string;
  };
  ciRole: {
    roleName: string;
    description: string;
    maxSessionDuration: cdk.Duration;
    stringEquals: Record<string, string>;
    stringLike: Record<string, string>;
  };
  ecr?: {
    repo: cdk.aws_ecr.IRepository;
  };
  roles: iam.PolicyStatement[];
};
