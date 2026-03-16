import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RdsSecurityGroupProps } from  '../../interfaces/rds';



/**
 * RdsSecurityGroup
 *
 * Single responsibility: create the RDS security group and wire
 * ingress rules from all provided sources.
 */
export class RdsSecurityGroup extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: RdsSecurityGroupProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      description: 'RDS cluster security group',
      allowAllOutbound: true,
    });

    for (const source of props.ingressSources) {
      for (const { port, description } of source.portRules) {
        this.securityGroup.addIngressRule(
          source.securityGroup,
          port,
          description,
        );
      }
    }
  }
}
