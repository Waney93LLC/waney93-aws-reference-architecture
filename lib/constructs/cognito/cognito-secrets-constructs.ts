import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CognitoSecretsConstructProps } from '../../interfaces/cognito';

export class CognitoSecretsConstruct extends Construct {
  public readonly secret: secretsmanager.Secret;

  constructor(
    scope: Construct,
    id: string,
    props: CognitoSecretsConstructProps,
  ) {
    super(scope, id);

    this.secret = new secretsmanager.Secret(this, 'CognitoOidcSecret', {
      secretName: props.secretName,
      description:
        'OIDC client details for Django app (Cognito User Pool client).',
    });

    // 1) DescribeUserPoolClient -> get ClientSecret  [oai_citation:4‡AWS Documentation](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_DescribeUserPoolClient.html?utm_source=chatgpt.com)
    const describeClient = new cr.AwsCustomResource(
      this,
      'DescribeUserPoolClient',
      {
        onCreate: {
          service: 'CognitoIdentityServiceProvider',
          action: 'describeUserPoolClient',
          parameters: {
            UserPoolId: props.userPoolId,
            ClientId: props.userPoolClientId,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `DescribeUserPoolClient-${props.userPoolId}-${props.userPoolClientId}`,
          ),
        },
        onUpdate: {
          service: 'CognitoIdentityServiceProvider',
          action: 'describeUserPoolClient',
          parameters: {
            UserPoolId: props.userPoolId,
            ClientId: props.userPoolClientId,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `DescribeUserPoolClient-${props.userPoolId}-${props.userPoolClientId}`,
          ),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['cognito-idp:DescribeUserPoolClient'],
            resources: ['*'],
          }),
        ]),
      },
    );

    const clientSecret = describeClient.getResponseField(
      'UserPoolClient.ClientSecret',
    );

    // 2) PutSecretValue with JSON payload
    const secretPayload = cdk.Fn.sub(
      [
        '{',
        '  "OIDC_RP_CLIENT_ID": "${CLIENT_ID}",',
        '  "OIDC_RP_CLIENT_SECRET": "${CLIENT_SECRET}",',
        '  "COGNITO_USER_POOL_ID": "${USER_POOL_ID}",',
        '  "COGNITO_CUSTOM_DOMAIN": "${CUSTOM_DOMAIN}",',
        '  "COGNITO_HOSTED_UI_BASE_URL": "https://${CUSTOM_DOMAIN}",',
        '  "AWS_REGION": "${AWS_REGION}"',
        '}',
      ].join('\n'),
      {
        CLIENT_ID: props.userPoolClientId,
        CLIENT_SECRET: clientSecret,
        USER_POOL_ID: props.userPoolId,
        CUSTOM_DOMAIN: props.customDomainName,
        AWS_REGION: props.region,
      },
    );

    const putSecretValue = new cr.AwsCustomResource(
      this,
      'PutOidcSecretValue',
      {
        onCreate: {
          service: 'SecretsManager',
          action: 'putSecretValue',
          parameters: {
            SecretId: this.secret.secretArn,
            SecretString: secretPayload,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `PutSecretValue-${props.userPoolId}-${props.userPoolClientId}`,
          ),
        },
        onUpdate: {
          service: 'SecretsManager',
          action: 'putSecretValue',
          parameters: {
            SecretId: this.secret.secretArn,
            SecretString: secretPayload,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `PutSecretValue-${props.userPoolId}-${props.userPoolClientId}`,
          ),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['secretsmanager:PutSecretValue'],
            resources: [this.secret.secretArn],
          }),
        ]),
      },
    );

    // Ensure Describe runs first
    putSecretValue.node.addDependency(describeClient);
  }
}
