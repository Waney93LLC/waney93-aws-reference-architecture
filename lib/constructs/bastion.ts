// rds-bastion.ts (converted from Stack -> Construct)
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import {BastionConfig } from '../interfaces/bastion';
import { ResourceConfigFacade } from '../config/environment';

/**
 * RdsBastion
 * 
 * Purpose: This construct defines a bastion host for managing RDS operations. It creates an EC2 instance with SSM capabilities, allowing secure access to RDS instances without exposing them to the public internet. The construct also sets up necessary IAM roles and security groups for secure operation.
 * 
 * Key Features:
 * - Allows runbook automation access to RDS instances via SSM.
 * - Configurable instance type, AMI, and user data for the bastion host.
 * - Security group configuration to control access to the bastion host.
 * - Optional integration with a migration storage bucket for operations that require temporary storage.
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

    this.role = this.createBastionRole();

    // Allow sending SSM command against the custom document (if you create it)
    this.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:SendCommand',
          'ssm:GetCommandInvocation',
          'ssm:ListCommandInvocations',
        ],
        resources: [
          `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:document/${props.runCommandDocumentName}`,
        ],
      }),
    );

    if (props.migrationStorageBucketArn) {
      const bucketArn = cdk.Fn.importValue(props.migrationStorageBucketArn);
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
    const { tagKey, tagValue } = bastionConfig;
    if (tagKey && tagValue) {
      cdk.Tags.of(this.instance).add(tagKey, tagValue);
    }
  }

  /**
   * The instance role is created with the base permissions required for SSM and Secrets Manager access. Additional permissions can be added as needed, such as access to specific S3 buckets for migration operations.
   * @returns iam.Role
   */
  private createBastionRole(): iam.Role {
    return new iam.Role(this, 'BastionRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'EC2 role for SSM-managed bastion',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
      ],
    });
  }
}
