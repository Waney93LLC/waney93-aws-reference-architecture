
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { BastionBaseConfig, BastionInstanceConfig, BastionSecurityGroupConfig, RdsBastionConfigBuilderProps} from '../interfaces/bastion';



export class RdsBastionConfigBuilder {
  constructor(
    private readonly scope: Construct,
    private readonly props: RdsBastionConfigBuilderProps,
    private readonly vpc: ec2.IVpc
  ) {}

  public build(): BastionBaseConfig {
    const userData = this.createUserData();
    const role = this.createBastionRole();
    const securityGroup = this.createBastionSecurityGroup();

    return {
      subnetSelection: this.props.subnetSelection,
      bastionConfig: this.createBastionInstanceConfig(userData, role),
      migrationOps: this.props.migrationOps,
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
      description: 'Security group for RDS bastion host',
    });
  }

  private createSecurityGroupConfig(
    securityGroup: ec2.SecurityGroup,
  ): BastionSecurityGroupConfig {
    return {
      ports: this.props.securityGroupPorts,
      definition: securityGroup,
      ingressRuleDescription: 'Allow outbound access to databases',
    };
  }
}
