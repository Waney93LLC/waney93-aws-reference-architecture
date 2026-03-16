import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBastionRoleProvider } from '../../interfaces/bastion';

/**
 * BastionIamRole
 *
 * Single responsibility: own and configure the IAM role for the bastion.
 * Exposes `IBastionRoleProvider` so consumers depend on the abstraction,
 * not this concrete class (DIP). A test double or custom role can satisfy
 * the same interface without touching this construct.
 */
export class BastionIamRole extends Construct implements IBastionRoleProvider {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'SSM-managed bastion role for RDS operations',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
      ],
    });
  }

  /**
   * Adds an SSM SendCommand permission scoped to a single document.
   * Called by the parent construct — not baked into the constructor —
   * so the permission is only added when a document name is known.
   */
  public grantSsmSendCommand(documentArn: string): void {
    this.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:SendCommand',
          'ssm:GetCommandInvocation',
          'ssm:ListCommandInvocations',
        ],
        resources: [documentArn],
      }),
    );
  }

  public grantS3Access(bucketArn: string): void {
    const bucket = s3.Bucket.fromBucketArn(this, 'MigrationBucket', bucketArn);
    bucket.grantReadWrite(this.role);
  }
}
