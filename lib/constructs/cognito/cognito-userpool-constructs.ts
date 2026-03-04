import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CognitoUserPoolConstructProps } from '../../interfaces/cognito';

export class CognitoUserPoolConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly client: cognito.UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    props: CognitoUserPoolConstructProps,
  ) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${props.appName}-user-pool`,
      selfSignUpEnabled: props.userPoolSelfSignUpEnabled,
      signInAliases: {
        email: true,
        username: props.allowUsernameSignIn,
      },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.removalPolicy,
    });

    // this.client = this.userPool.addClient('DjangoWebClient', {
    //   generateSecret: true,
    //   oAuth: {
    //     flows: { authorizationCodeGrant: true },
    //     scopes: [
    //       cognito.OAuthScope.OPENID,
    //       cognito.OAuthScope.EMAIL,
    //       cognito.OAuthScope.PROFILE,
    //     ],
    //     callbackUrls: props.callbackUrls,
    //     logoutUrls: props.logoutUrls,
    //   },
    //   supportedIdentityProviders: [
    //     cognito.UserPoolClientIdentityProvider.COGNITO,
    //   ],
    // });
  }
}
