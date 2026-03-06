// rds-bastion.ts (converted from Stack -> Construct)
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { RDSBastionStackProps } from '../interfaces/bastion';


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

  constructor(scope: Construct, id: string, props: RDSBastionStackProps) {
    super(scope, id);

    const {
      vpc,
      subnetSelection = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instance,
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

    this.role = instance.role;

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



    // // Latest AL2023
    // const ami = ec2.MachineImage.latestAmazonLinux2023({
    //   cachedInContext: false,
    // });

    // // User data: tiny utilities + optional DB clients
    // const userData = ec2.UserData.forLinux();
    // userData.addCommands(
    //   'set -eux',
    //   'sudo dnf -y update',
    //   'sudo dnf -y install --allowerasing curl postgresql17 python3 jq unzip',
    // );

    // this.instance = new ec2.Instance(this, 'Bastion', {
    //   vpc,
    //   vpcSubnets: subnetSelection,
    //   instanceType: instance.type,
    //   machineImage: ami,
    //   role: this.role,
    //   securityGroup: this.securityGroup,
    //   ssmSessionPermissions: true,
    //   detailedMonitoring: true,
    //   userData,
    // });

    // // Nice to have: Name tag (uses parent Stack name for uniqueness)
    // cdk.Tags.of(this.instance).add(
    //   'Name',
    //   `${cdk.Stack.of(this).stackName}-host`,
    // );
  }

  // Helper function to get the necessary assets from s3 bucket that will enable the migration process
  enableS3AssetsForMigration(): ssm.CfnDocument {
    // Optional: S3 access + optional SSM Document (migration doc)
    // if (s3BucketOps) {
    //   s3BucketOps.grantReadWrite(this.role);
    //   // This is redundant with grantReadWrite (but keeping since you had it explicit)
    //   this.role.addToPrincipalPolicy(
    //     new iam.PolicyStatement({
    //       actions: [
    //         's3:ListBucket',
    //         's3:GetObject',
    //         's3:PutObject',
    //         's3:DeleteObject',
    //       ],
    //       resources: [s3BucketOps.bucketArn, `${s3BucketOps.bucketArn}/*`],
    //     }),
    //   );
    //   if (migrationOps) {
    //     const migrationSteps = this.getMigrationDocs(
    //       `s3://${s3BucketOps.bucketName}/${migrationOps.config.CONFIG_URL.PATH}`,
    //       migrationOps.config.CONFIG_URL.FILE,
    //     );
    //     new ssm.CfnDocument(this, 'BastionMigrationDoc', {
    //       name: migrationOps.config.runCommandDocumentName,
    //       documentType: 'Command',
    //       content: {
    //         schemaVersion: '2.2',
    //         description: 'Run Django migration from S3 to Aurora',
    //         mainSteps: [
    //           {
    //             action: 'aws:runShellScript',
    //             name: migrationOps.config.SCRIPT.NAME,
    //             inputs: { runCommand: migrationSteps },
    //           },
    //         ],
    //       },
    //     });
    //   }
    // }
  }

  getMigrationDocs(
    migrationURI: string,
    migrationConfigFile: string,
  ): string[] {
    return [
      'set -euxo pipefail',
      'cd /home/ec2-user',
      `export MIGRATION_URI="${migrationURI}" `,
      `export MIGRATION_CONFIG_FILE="${migrationConfigFile}" `,
      `aws s3 cp $MIGRATION_URI$MIGRATION_CONFIG_FILE .`,
      'export ASSETS_FOLDER=$(jq -r ".assets_folder" $MIGRATION_CONFIG_FILE)',
      'export MIGRATION_ASSETS="${ASSETS_FOLDER}.zip"',
      'aws s3 cp $MIGRATION_URI$MIGRATION_ASSETS .',
      'unzip $MIGRATION_ASSETS -d "${ASSETS_FOLDER}"',
      'mv "${ASSETS_FOLDER}/${ASSETS_FOLDER}"/* .',
      'rm -rf "${ASSETS_FOLDER}"',
      'rm "${ASSETS_FOLDER}.zip"',
      'export DATA_DUMP_FILE=$(jq -r ".data_dump_file" $MIGRATION_CONFIG_FILE)',
      'export SECRET_ID=$(jq -r ".db_secret_id" $MIGRATION_CONFIG_FILE)',
      'export APP_USER_SECRET_ID=$(jq -r ".app_user_secret_id" $MIGRATION_CONFIG_FILE)',
      'export MIGRATION_PROCESS_FILE=$(jq -r ".migration_process_file" $MIGRATION_CONFIG_FILE)',
      'chmod +x $MIGRATION_PROCESS_FILE',
      './$MIGRATION_PROCESS_FILE',
    ];
  }
}
