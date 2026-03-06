import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { MIGRATION_OPS_CONFIG } from './shared-services';


/**
 * An interface for configuring the bastion security groups
 *
 */
export interface BastionSecurityGroupConfig {
  ports: { port: ec2.Port; description: string }[];
  definition: ec2.SecurityGroup;
  ingressRuleDescription: string;
}
/**
 * This is an extension for the stack poperties used to create a bastion host for RDS access.
 *
 */
export interface RDSBastionStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  /**
   * Prefer private subnet + NAT for outbound,
   * but public subnet works too. Default: public
   */
  subnetSelection?: ec2.SubnetSelection;
  instance:{
    type: ec2.InstanceType;
    role:iam.Role;
  };
  
  /**
   * Optional: install DB clients via user data
   */
  installClients?: { postgres?: boolean; mysql?: boolean };
  s3BucketOps?: IBucket;
  migrationOps: MigrationOperations;
  bastionSecGrpConfig: BastionSecurityGroupConfig;
}


/**
 * Interface for migration objects
 */
export interface MigrationOperations {
  secretId: string;
  appUserSecretId: string;
  appUserName?: string;
  config: MIGRATION_OPS_CONFIG;
}



export interface BootstrapAutomationStackProps extends cdk.StackProps {
  /**
   * The CloudFormation stack name that represents your Foundations stack
   * Example: "devStage-Foundations" (whatever the actual stack name is in CFN)
   */
  readonly targetStackName: string;

  /**
   * Tag key/value used to identify the bastion (or bootstrap runner) instance.
   * Example: Key="Role", Value="Bastion"
   */
  readonly targetInstanceTagKey: string;
  readonly targetInstanceTagValue: string;

  /**
   * Your existing Run Command document name (already created elsewhere).
   * Example: "BastionMigrationDoc"
   */
  readonly runCommandDocumentName: string;

  /**
   * Optional: automation runbook name (SSM document name).
   * Defaults to "RunBootstrapOnFoundationCreate"
   */
  readonly automationRunbookName?: string;
}