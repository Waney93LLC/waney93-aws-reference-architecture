import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RdsProps } from '../../interfaces/rds';
import { RdsSecurityGroup } from './rds-security-group';
import { AuroraCluster } from './rds-cluster';
import { RdsAppUserSecret } from './rds-app-user-secret';

/**
 * AuroraDB
 *
 * Root construct. Its only responsibility is composing sub-constructs
 * and exposing their public surfaces. No logic lives here.
 */
export class AuroraDB extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly cluster: rds.DatabaseCluster;
  public readonly appUserSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: RdsProps) {
    super(scope, id);

    const sgConstruct = new RdsSecurityGroup(this, 'SecurityGroup', {
      vpc: props.network.vpc,
      ingressSources: props.ingressSources,
    });
    this.securityGroup = sgConstruct.securityGroup;

    const clusterConstruct = new AuroraCluster(this, 'Cluster', {
      vpc: props.network.vpc,
      securityGroup: this.securityGroup,
      clusterConfig: props.cluster,
    });
    this.cluster = clusterConstruct.cluster;

    const secretConstruct = new RdsAppUserSecret(
      this,
      'AppUserSecret',
      props.appUser,
    );
    this.appUserSecret = secretConstruct.secret;
  }
}
