import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BastionSecurityGroupProps, IBastionSecurityGroupConfig } from  '../../interfaces/bastion';

/**
 * BastionSecurityGroup
 *
 * Single responsibility: apply egress rules to the provided security group.
 * Does not create the security group itself — that is the caller's concern,
 * keeping network topology decisions outside this construct.
 */
export class BastionSecurityGroup extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: BastionSecurityGroupProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      description: 'Bastion host security group',
      securityGroupName: props.config.securityGroupName,
      allowAllOutbound: props.config.allowAllOutbound ?? false,
    });

    for (const { port, description } of props.config.portRules) {
      this.securityGroup.addEgressRule(ec2.Peer.anyIpv4(), port, description);
    }
  }
}
