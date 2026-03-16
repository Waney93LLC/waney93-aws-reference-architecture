import { Construct } from 'constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { IRdsAppUserConfig } from '../../interfaces/rds';

/**
 * RdsAppUserSecret
 *
 * Single responsibility: create the application user secret with a
 * generated password. Completely decoupled from cluster and network concerns.
 */
export class RdsAppUserSecret extends Construct {
  public readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, config: IRdsAppUserConfig) {
    super(scope, id);

    this.secret = new secretsmanager.Secret(this, 'Secret', {
      secretName: config.secretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: config.username }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });
  }
}
