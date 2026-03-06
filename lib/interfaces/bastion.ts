
import { IBucket } from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { MIGRATION_OPS_CONFIG } from './shared-services';


export interface BastionPortRule {
  port: ec2.Port;
  description: string;
}

export interface BastionSecurityGroupConfig {
  ports: BastionPortRule[];
  definition: ec2.SecurityGroup;
  ingressRuleDescription: string;
}

export interface BastionInstanceConfig {
  type: ec2.InstanceType;
  role: iam.Role;
  ami: ec2.IMachineImage;
  userData: ec2.UserData;
}

export interface MigrationAppUserCredentials {
  name: string;
  secretName: string;
}

export interface MigrationDatabaseCredentials {
  loginSecretName: string;
  appUser: MigrationAppUserCredentials;
}

export interface MigrationOperations {
  config: MIGRATION_OPS_CONFIG;
  databaseCredentials: MigrationDatabaseCredentials;
}

export interface BastionBaseConfig {
  subnetSelection?: ec2.SubnetSelection;
  bastionConfig: BastionInstanceConfig;
  s3BucketOps?: IBucket;
  migrationOps: MigrationOperations;
  bastionSecGrpConfig: BastionSecurityGroupConfig;
}

export interface BastionConfig extends BastionBaseConfig {
  vpc: ec2.IVpc;
}



export interface RdsBastionConfigBuilderProps {
  userDataCommands?: string[];
  subnetSelection?: ec2.SubnetSelection;
  instance: {
    type: ec2.InstanceType;
    ami: ec2.IMachineImage;
  };
  securityGroupPorts: BastionPortRule[];
  migrationOps: MigrationOperations;
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