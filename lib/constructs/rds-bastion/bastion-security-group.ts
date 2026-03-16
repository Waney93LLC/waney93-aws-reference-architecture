import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IBastionSecurityGroupConfig } from  '../../interfaces/bastion';

/**
 * BastionSecurityGroup
 *
 * Single responsibility: apply egress rules to the provided security group.
 * Does not create the security group itself — that is the caller's concern,
 * keeping network topology decisions outside this construct.
 */
export class BastionSecurityGroup extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    config: IBastionSecurityGroupConfig,
  ) {
    super(scope, id);

    this.securityGroup = config.definition;

    for (const { port, description } of config.portRules) {
      this.securityGroup.addEgressRule(ec2.Peer.anyIpv4(), port, description);
    }
  }
}
