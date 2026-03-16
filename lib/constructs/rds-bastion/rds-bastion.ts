import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RdsBastionProps } from '../../interfaces/bastion';
import { BastionIamRole } from './bastion-iam-role';
import { BastionSecurityGroup } from './bastion-security-group';
import { BastionInstance } from './bastion-instance';

/**
 * RdsBastion
 *
 * Root construct. Its sole responsibility is composition —
 * it wires sub-constructs together and passes dependencies between them.
 * It contains no business logic of its own (SRP).
 *
 * Extension points:
 * - Swap `roleProvider` for a custom implementation without touching this class (OCP + DIP).
 * - Add new optional config blocks (e.g. `backupStorageConfig`) without breaking
 *   existing consumers (ISP — they won't see the new optional prop).
 */
export class RdsBastion extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly instance: ec2.Instance;
  public readonly role: iam.IRole;

  constructor(scope: Construct, id: string, props: RdsBastionProps) {
    super(scope, id);

    const sgConstruct = new BastionSecurityGroup(
      this,
      'SecurityGroup',
      { vpc: props.network.vpc, config: props.securityGroup },
    );
    this.securityGroup = sgConstruct.securityGroup;

    const roleProvider =
      props.roleProvider ?? new BastionIamRole(this, 'BastionRole');

    this.role = roleProvider.role;

    if (roleProvider instanceof BastionIamRole) {
      roleProvider.grantSsmSendCommand(
        `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:document/${props.runCommandDocumentName}`,
      );

      if (props.migrationStorage) {
        const bucketArn = cdk.Fn.importValue(
          props.migrationStorage.migrationStorageBucketExportName,
        );
        roleProvider.grantS3Access(bucketArn);
      }
    }

    const instanceConstruct = new BastionInstance(this, 'Instance', {
      network: props.network,
      instanceConfig: props.instance,
      role: this.role,
      securityGroup: this.securityGroup,
    });
    this.instance = instanceConstruct.instance;
  }
}
