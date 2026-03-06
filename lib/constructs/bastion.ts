// rds-bastion.ts (converted from Stack -> Construct)
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { MigrationOperations, BastionConfig } from '../interfaces/bastion';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { getS3MigrationScriptSteps } from '../config/migrations/templates';

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
      s3BucketOps,
      migrationOps,
      bastionSecGrpConfig,
    } = props;

    this.securityGroup = bastionSecGrpConfig.definition;

    for (const { port, description } of bastionSecGrpConfig.ports) {
      this.securityGroup.addEgressRule(
        ec2.Peer.anyIpv4(),
        port,
        description ?? bastionSecGrpConfig.ingressRuleDescription,
      );
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
          `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:document/${migrationOps.config.runCommandDocumentName}`,
        ],
      }),
    );

    // An SSM document is created based on where its assets are stored, whether in an S3 bucket or another location.
    if (s3BucketOps) {
      this.enableS3AssetsForMigration(s3BucketOps, this.role, migrationOps);
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

    cdk.Tags.of(this.instance).add(
      'Name',
      `${cdk.Stack.of(this).stackName}-host`,
    );
  }

  /**
   * Enables S3 assets for migration by creating an SSM document that runs migration scripts stored in the specified S3 bucket.
   * @param s3BucketOps The S3 bucket containing the migration scripts and configuration.
   * @param bastionRole The IAM role associated with the bastion host, which will be granted permissions to access the S3 bucket.
   * @param migrationOps The migration operations configuration, including details about the migration scripts and process.
   * @returns The created SSM document that can be used to execute the migration steps on the bastion host.
   */
  private enableS3AssetsForMigration(
    s3BucketOps: IBucket,
    bastionRole: iam.Role,
    migrationOps: MigrationOperations,
  ): ssm.CfnDocument {
    s3BucketOps.grantReadWrite(bastionRole);
    if (!migrationOps.config.script) {
      throw new Error(
        'Migration script configuration is required to create migration SSM Document',
      );
    }
    const migrationSteps = getS3MigrationScriptSteps(
      `s3://${s3BucketOps.bucketName}/${migrationOps.config.script.folderPath}`,
      migrationOps.config.script.entryFile,
    );
    return new ssm.CfnDocument(this, 'BastionMigrationDoc', {
      name: migrationOps.config.runCommandDocumentName,
      documentType: 'Command',
      content: {
        schemaVersion: '2.2',
        description:
          migrationOps.config.script.description ||
          'SSM Document to run migration scripts on the bastion host',
        mainSteps: [
          {
            action: 'aws:runShellScript',
            name: migrationOps.config.automationRunbookName,
            inputs: { runCommand: migrationSteps },
          },
        ],
      },
    });
  }
}
