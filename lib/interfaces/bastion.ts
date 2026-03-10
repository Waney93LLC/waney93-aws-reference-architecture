
import { IBucket } from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { MIGRATION_OPS_CONFIG } from './shared-services';
import { IParameterResolver } from './parameter-resolver';
import { Stage } from '../config/environment';
import { PortRule, SecurityGroupConfig } from './common';




export interface BastionInstanceConfig {
  type: ec2.InstanceType;
  role: iam.Role;
  ami: ec2.IMachineImage;
  userData?: ec2.UserData;
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
  bastionSecGrpConfig: SecurityGroupConfig;
}

export interface BastionConfig extends BastionBaseConfig {
  vpc: ec2.IVpc;
}

export interface RdsBastionConfig {
  userDataCommands?: string[];
  subnetSelection?: ec2.SubnetSelection;
  instance: {
    type: ec2.InstanceType;
    ami: ec2.IMachineImage;
  };
  securityGroupPorts: PortRule[];
  parameterResolver: IParameterResolver;
  config: MIGRATION_OPS_CONFIG;
}