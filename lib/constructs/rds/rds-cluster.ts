import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { RdsClusterProps } from  '../../interfaces/rds';


/**
 * RdsCluster
 *
 * Single responsibility: configure and create the Aurora Serverless v2 cluster.
 * Receives its security group as an injected dependency — it has no opinion
 * on how that group was created or what rules it carries.
 */
export class AuroraCluster extends Construct {
  public readonly cluster: rds.DatabaseCluster;

  constructor(scope: Construct, id: string, props: RdsClusterProps) {
    super(scope, id);

    const { vpc, securityGroup, clusterConfig } = props;

    this.cluster = new rds.DatabaseCluster(this, clusterConfig.id, {
      vpc,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_7,
      }),
      securityGroups: [securityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      defaultDatabaseName: clusterConfig.databaseName,
      credentials: rds.Credentials.fromGeneratedSecret(
        clusterConfig.admin.username,
        { secretName: clusterConfig.admin.secretName },
      ),
      deletionProtection: clusterConfig.deletionProtection,
      serverlessV2MinCapacity: clusterConfig.capacity?.min ?? 0,
      serverlessV2MaxCapacity: clusterConfig.capacity?.max ?? 1,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: clusterConfig.readers ?? [],
      backup: { retention: cdk.Duration.days(1) },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    cdk.Tags.of(this.cluster).add('Name', clusterConfig.name);
  }
}
