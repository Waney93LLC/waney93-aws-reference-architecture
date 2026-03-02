import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { OidcCiRoleConstructProps } from  '../interfaces/odic-ci-role';

/**
 * OidcCiRoleConstruct
 *
 * Purpose:
 *   A convenient construct to create a CI/CD role for GitHub Actions using OIDC federation. This should be generic so it can be inherited so that other providers can use it as well.
 *
 *
 */

export class OidcCiRoleConstruct extends Construct {
  public readonly oidcProvider: iam.IOpenIdConnectProvider;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: OidcCiRoleConstructProps) {
    super(scope, id);
    const { provider, roles } = props;

    // OIDC Provider (should be once per account; if you later need to "import" an existing one,
    // we can adjust this construct to accept an optional providerArn)
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'OidcProvider', {
      url: provider.url,
      clientIds: provider.clientIds,
      thumbprints: provider.thumbprints,
    });
    this.oidcProvider = oidcProvider;

    // Federated principal conditions
    const assumedBy = new iam.FederatedPrincipal(
      oidcProvider.openIdConnectProviderArn,
      {
        StringEquals: props.ciRole.stringEquals,
        StringLike: props.ciRole.stringLike,
      },
      'sts:AssumeRoleWithWebIdentity',
    );

    const role = new iam.Role(this, 'CiRole', {
      roleName: props.ciRole.roleName,
      assumedBy,
      description: props.ciRole.description,
      maxSessionDuration: props.ciRole.maxSessionDuration,
    });
    this.role = role;

    // Optional: grant ECR pull/push if repo supplied
    if (props.ecr?.repo) {
      props.ecr.repo.grantPullPush(role);
    }

    // Baseline CI permissions (mirrors your existing stack)
    roles.forEach((policyStatement) => {
      role.addToPolicy(policyStatement);
    });
  }
}
