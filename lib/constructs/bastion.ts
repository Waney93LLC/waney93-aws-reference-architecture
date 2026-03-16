// rds-bastion.ts (converted from Stack -> Construct)
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import {BastionConfig } from '../interfaces/bastion';
import { ResourceConfigFacade } from '../config/environment';

/**
 * Bastion host module (SSM-managed) for accessing RDS in the VPC.
 * - Creates: Security Group + EC2 Instance + IAM Role
 * - Optionally: SSM Document for running migration steps sourced from S3
 *
 * NOTE: Outputs (CfnOutput) must be created from a Stack scope, not a Construct.
 * Emit outputs from the parent Stack if needed.
 */
export class RdsBastion extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly instance: ec2.Instance;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: BastionConfig) {
    super(scope, id);

    const {
      vpc,
      subnetSelection = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      bastionConfig,
      bastionSecGrpConfig,
    } = props;

    this.securityGroup = bastionSecGrpConfig.definition;

    for (const { port, description } of bastionSecGrpConfig.portRules) {
      this.securityGroup.addEgressRule(ec2.Peer.anyIpv4(), port, description);
    }

    this.role = bastionConfig.role;
 

    // Allow sending SSM command against the custom document (if you create it)
    this.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:SendCommand',
          'ssm:GetCommandInvocation',
          'ssm:ListCommandInvocations',
        ],
        resources: [
          `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:document/${config.runCommandDocumentName}`,
        ],
      }),
    );
    const storageConfig = ResourceConfigFacade.ExportedValueName.storage ?? {
      migrationStorageBucketArn: '',
    };

    if (storageConfig.migrationStorageBucketArn) {
      const bucketArn = cdk.Fn.importValue(
        storageConfig.migrationStorageBucketArn,
      );
      const bucket = cdk.aws_s3.Bucket.fromBucketArn(
        this,
        'ImportedMigrationStorageBucket',
        bucketArn,
      );
      bucket.grantReadWrite(this.role);
    }

    this.instance = new ec2.Instance(this, 'Bastion', {
      vpc,
      vpcSubnets: subnetSelection,
      instanceType: bastionConfig.type,
      machineImage: bastionConfig.ami,
      role: this.role,
      securityGroup: this.securityGroup,
      ssmSessionPermissions: true,
      detailedMonitoring: true,
      userData: bastionConfig.userData,
    });
    const { target } = migrationOps.config;
    cdk.Tags.of(this.instance).add(
      target.instance.tagKey,
      target.instance.tagValue,
    );
  }

}
