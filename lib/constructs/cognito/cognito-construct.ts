import { Construct } from 'constructs';
import { CognitoConstructProps } from '../../interfaces/cognito';
import { CognitoUserPoolConstruct } from './cognito-userpool-constructs';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { CognitoSecretsConstruct } from './cognito-secrets-constructs';

/**
 * CognitoConstruct
 *
 * Purpose:
 *   Construct that encapsulates all Cognito-related resources, such as User Pool,
 *   User Pool Client, custom domain, and secrets. This is a composition of multiple
 *   smaller constructs (e.g., CognitoUserPoolConstruct, CognitoSecretsConstruct).
 */
export class CognitoConstruct extends Construct {
  private props: CognitoConstructProps;
  /**
   * Create a new instance of CognitoConstruct.
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);
    this.props = props;
  }

  /**
   * Adds a Cognito User Pool to the construct.
   * @returns CognitoUserPoolConstruct
   */
  public createUserPool(): CognitoUserPoolConstruct {
    const { idPrefix, cognito } = this.props;
    if (!cognito) {
      throw new Error('Cognito configuration is required to create User Pool');
    }
    const {
      app,
    } = cognito;
    return new CognitoUserPoolConstruct(this, `${idPrefix}UserPool`, {
      appName: app.name,
      callbackUrls: app.callbackUrls,
      logoutUrls: app.logoutUrls,
      ...cognito,
    });
  }

  /**
   * Adds a custom domain and certificate to the Cognito User Pool.
   * @param userPool
   * @returns acm.ICertificate
   */
  public customDomainAndCert(
    userPool: CognitoUserPoolConstruct,
  ): acm.ICertificate {
    const { idPrefix, cognito } = this.props;
    if (!cognito) {
      throw new Error(
        'Cognito configuration is required to create custom domain and certificate',
      );
    }
    const { acmCertificateArn, customDomainName } = cognito;
    if (!acmCertificateArn) {
      throw new Error(
        'acmCertificateArn is required for withCustomDomainAndCert().',
      );
    }
    const domainCert = acm.Certificate.fromCertificateArn(
      this,
      `${idPrefix}DomainCert`,
      acmCertificateArn,
    );
    userPool.userPool.addDomain('UserPoolDomain', {
      customDomain: {
        domainName: customDomainName,
        certificate: domainCert,
      },
    });
    return domainCert;
  }

  /**
   * Adds secrets to store Cognito User Pool and User Pool Client IDs, and integrates with the custom domain.
   * @param userPool
   * @returns
   */
  public createSecrets(userPool: CognitoUserPoolConstruct) {
    const { idPrefix, cognito } = this.props;
    if (!cognito) {
      throw new Error('Cognito configuration is required to create secrets');
    }
    const { app, customDomainName } = cognito;

    const stack = cdk.Stack.of(this);

    const secrets = new CognitoSecretsConstruct(this, `${idPrefix}Secrets`, {
      secretName: app.secret.name,

      userPoolId: userPool.userPool.userPoolId,
      userPoolClientId: userPool.client.userPoolClientId,

      customDomainName: customDomainName,
      region: stack.region,
    });
    return secrets;
  }
}
