import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

// (I) — Interfaces are split by concern.
// No consumer is forced to depend on props it doesn't use.

export interface IBastionNetworkConfig {
  vpc: ec2.IVpc;
  subnetSelection?: ec2.SubnetSelection;
}

export interface IBastionSecurityGroupConfig {
  definition: ec2.SecurityGroup;
  portRules: IBastionPortRule[];
}

export interface IBastionPortRule {
  port: ec2.Port;
  description: string;
}

export interface IBastionInstanceConfig {
  type: ec2.InstanceType;
  ami: ec2.IMachineImage;
  userData?: ec2.UserData;
  detailedMonitoring?: boolean;
  tagKey?: string;
  tagValue?: string;
}

export interface IBastionRoleProvider {
  readonly role: iam.IRole;
  grantS3Access?(bucketArn: string): void;
}

export interface IBastionStorageConfig {
  migrationStorageBucketExportName: string;
}

export interface RdsBastionProps {
  network: IBastionNetworkConfig;
  securityGroup: IBastionSecurityGroupConfig;
  instance: IBastionInstanceConfig;
  roleProvider: IBastionRoleProvider; 
  runCommandDocumentName: string;
  migrationStorage?: IBastionStorageConfig;
}

export interface BastionInstanceProps {
  network: IBastionNetworkConfig;
  instanceConfig: IBastionInstanceConfig;
  role: iam.IRole;
  securityGroup: ec2.SecurityGroup;
}

export interface RdsBastionConfig {
  securityGroup: IBastionSecurityGroupConfig;
  instance: IBastionInstanceConfig;
  runCommandDocumentName: string;
  migrationStorage?: IBastionStorageConfig;
}

export interface BastionConfig {

}