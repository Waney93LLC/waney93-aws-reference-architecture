import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IParameterResolver } from './parameter-resolver';
import { IRdsClusterConfig, IRdsPortRule } from './rds';

// (I) — Interfaces are split by concern.
// No consumer is forced to depend on props it doesn't use.

export interface IBastionNetworkConfig {
  vpc: ec2.IVpc;
  subnetSelection?: ec2.SubnetSelection;
}

export interface IBastionSecurityGroupConfig {
  portRules: IBastionPortRule[];
  securityGroupName?: string; 
  allowAllOutbound?: boolean;
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

export interface BastionSecurityGroupProps {
  vpc: ec2.IVpc; 
  config: IBastionSecurityGroupConfig; 
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
  roleProvider?: IBastionRoleProvider; 
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
  roleProvider?: IBastionRoleProvider;
}

export interface AuroraDbConfig {
  parameterResolver: IParameterResolver;
  id: string;
  name: string;
  databaseName: string;
  deletionProtection: boolean;
  capacity?: { min: number; max: number };
  readers?: IRdsClusterConfig['readers'];
  bastionPortRules: IRdsPortRule[];
  appClientPortRules: IRdsPortRule[];
}