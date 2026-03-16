import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {
  BastionInstanceProps,
} from '../../interfaces/bastion';


/**
 * BastionInstance
 *
 * Single responsibility: configure and create the EC2 instance.
 * Receives all dependencies (role, security group, network) via props —
 * nothing is resolved internally.
 */
export class BastionInstance extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: BastionInstanceProps) {
    super(scope, id);

    const {
      network: {
        vpc,
        subnetSelection = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      },
      instanceConfig,
      role,
      securityGroup,
    } = props;

    this.instance = new ec2.Instance(this, 'Instance', {
      vpc,
      vpcSubnets: subnetSelection,
      instanceType: instanceConfig.type,
      machineImage: instanceConfig.ami,
      role,
      securityGroup,
      ssmSessionPermissions: true,
      detailedMonitoring: instanceConfig.detailedMonitoring ?? false,
      userData: instanceConfig.userData,
    });

    if (instanceConfig.tagKey && instanceConfig.tagValue) {
      cdk.Tags.of(this.instance).add(
        instanceConfig.tagKey,
        instanceConfig.tagValue,
      );
    }
  }
}
