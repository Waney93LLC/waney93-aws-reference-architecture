import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  BastionBaseConfig,
  BastionInstanceConfig,
  RdsBastionConfig,
} from '../interfaces/bastion';
import {
  Stage,
} from '../config/environment';
import { SecurityGroupConfig } from '../interfaces/common';


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
    

    return {
      subnetSelection: this.props.subnetSelection,
      bastionConfig: this.createBastionInstanceConfig(userData, role),
      bastionSecGrpConfig: this.createSecurityGroupConfig(securityGroup),
    };
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
