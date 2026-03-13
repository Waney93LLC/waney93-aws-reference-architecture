// rds.ts (converted from Stack -> Construct)
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubnetType, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
} from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RdsConstructProps } from '../interfaces/rds';

/**
 * Rds
 *
 * Purpose:
 *   Construct that defines an RDS cluster with a security group and secrets for admin and an app user.
 */
export class Rds extends Construct {
  public readonly cluster: DatabaseCluster;
  public readonly securityGroup: SecurityGroup;
  public readonly appUserSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: RdsConstructProps) {
    super(scope, id);

    const { secGrpConfigs, clusterConfig,vpc } = props;


    this.securityGroup = new SecurityGroup(this, 'RdsSecGrp', {
      vpc,
      securityGroupName: 'rdsSecurityGroup',
      description:
        'Security group for RDS cluster allowing access from bastion and app clients',
      allowAllOutbound: true,
    });

    secGrpConfigs.forEach((secGrpConfig) => {
      secGrpConfig.portRules.forEach((portRule) => {
        this.securityGroup.addIngressRule(
          secGrpConfig.definition,
          portRule.port,
          portRule.description,
        );
      });
    });

    this.cluster = new DatabaseCluster(this, clusterConfig.id, {
      vpc,
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_17_7,
      }),
      securityGroups: [this.securityGroup],
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      defaultDatabaseName: clusterConfig.databaseName,

      credentials: Credentials.fromGeneratedSecret(
        clusterConfig.admin.username,
        {
          secretName: clusterConfig.admin.secretName,
        },
      ),

      deletionProtection: clusterConfig.deletionProtection,
      serverlessV2MinCapacity: clusterConfig.capacity?.min ?? 0,
      serverlessV2MaxCapacity: clusterConfig.capacity?.max ?? 1,
      writer: ClusterInstance.serverlessV2('writer'),
      readers: clusterConfig.readers ?? [],

      backup: { retention: cdk.Duration.days(1) },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create a secret for the app user with a generated password that's different from the admin password. The app user will have limited permissions defined in the database.
    this.appUserSecret = new secretsmanager.Secret(this, 'AppUserSecret', {
      secretName: clusterConfig.app.secretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: clusterConfig.app.username,
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    cdk.Tags.of(this.cluster).add('Name', clusterConfig.name);
  }
}
