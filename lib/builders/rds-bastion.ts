import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  BastionBaseConfig,
  BastionInstanceConfig,
  MigrationDatabaseCredentials,
  MigrationOperations,
  RdsBastionConfig,
} from '../interfaces/bastion';
import {
  getResourceParameterConfig,
  ResourceConfigFacade,
  Stage,
} from '../config/environment';
import { SecurityGroupConfig } from '../interfaces/common';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { aws_s3 } from 'aws-cdk-lib';

export class RdsBastionConfigBuilder {
  constructor(
    private readonly scope: Construct,
    private readonly props: RdsBastionConfig,
    private readonly stage: Stage,
    private readonly vpc: ec2.IVpc,
  ) {}

  public build(): BastionBaseConfig {
    const userData = this.createUserData();
    const role = this.createBastionRole();
    const securityGroup = this.createBastionSecurityGroup();
    const resourceConfig = new ResourceConfigFacade(
      this.props.parameterResolver,
      getResourceParameterConfig(this.stage),
    );

    return {
      subnetSelection: this.props.subnetSelection,
      bastionConfig: this.createBastionInstanceConfig(userData, role),
      migrationOps: this.getMigrationOpsConfig(resourceConfig),
      bastionSecGrpConfig: this.createSecurityGroupConfig(securityGroup),
      s3BucketOps: this.getMigrationStorage(),
    };
  }

  private getMigrationOpsConfig(
    resourceConfig: ResourceConfigFacade,
  ): MigrationOperations {
    const dbCreds = resourceConfig.getDatabaseCredentials();
    const migration = resourceConfig.getMigrationScriptConfig();
    const dbCredentials: MigrationDatabaseCredentials = {
      loginSecretName: dbCreds.loginSecretName,
      appUser: {
        name: dbCreds.appUserName,
        secretName: dbCreds.appUserSecretName,
      },
    };

    return {
      config: {
        ...this.props.config,
        script: {
          folderPath: migration.folderPath,
          entryFile: migration.entryFile,
          description: migration.description,
        },
      },
      databaseCredentials: dbCredentials,
    };
  }

  private getMigrationStorage(): IBucket {
    const bucketArn = cdk.Fn.importValue(
      `MigrationStorageBucketArn`,
    );
    return aws_s3.Bucket.fromBucketArn(
      this.scope,
      'MigrationS3Bucket',
      bucketArn,
    );
  }

  private createUserData(): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    if (this.props.userDataCommands) {
      userData.addCommands(...this.props.userDataCommands);
    }
    return userData;
  }

  private createBastionRole(): iam.Role {
    return new iam.Role(this.scope, 'BastionRole', {
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

  private createBastionInstanceConfig(
    userData: ec2.UserData,
    role: iam.Role,
  ): BastionInstanceConfig {
    return {
      type: this.props.instance.type,
      role,
      ami: this.props.instance.ami,
      userData,
    };
  }

  private createBastionSecurityGroup(): ec2.SecurityGroup {
    return new ec2.SecurityGroup(this.scope, 'BastionSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for bastion host',
    });
  }

  private createSecurityGroupConfig(
    securityGroup: ec2.SecurityGroup,
  ): SecurityGroupConfig {
    return {
      portRules: this.props.securityGroupPorts,
      definition: securityGroup,
    };
  }
}
