// network-stack.ts  (transformed into a Construct)
import { Construct } from 'constructs';
import {
  Vpc,
  SubnetType,
  FlowLogDestination,
  FlowLogTrafficType,
  SecurityGroup,
  Peer,
  Port,
  IpAddresses,
  SubnetConfiguration,
} from 'aws-cdk-lib/aws-ec2';

import { NetworkProps } from '../interfaces/network';

/**
 * Network Construct
 *
 * Purpose:
 *   Responsible for creating the VPC, subnets, security groups, and related network resources.
 *
 * Notes:
 *   - This construct can be used in any stack that requires a VPC.
 *   - It creates a VPC with public and private subnets, flow logs, and a security group for endpoints.
 *   - The properties allow for customization of the VPC configuration.
 */
export class Network extends Construct {
  public readonly vpc: Vpc;
  public readonly endpointSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);

    const {
      maxAzs = 2,
      natGateways = 1,
      vpcCidr,
      logGrp,
      vpcEndpoints,
      cidrMaskPublic,
      cidrMaskPrivate = 24,
      idPrefix,
    } = props;

    const subentConfig: SubnetConfiguration[] = [];
    if (cidrMaskPublic) {
      subentConfig.push({
        name: 'public',
        subnetType: SubnetType.PUBLIC,
        cidrMask: cidrMaskPublic,
      });
    }

    subentConfig.push({
      name: 'private-egress',
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      cidrMask: cidrMaskPrivate,
    });

    this.vpc = new Vpc(this, 'Vpc', {
      vpcName:`${idPrefix}-vpc`,
      ipAddresses: vpcCidr ? IpAddresses.cidr(vpcCidr) : undefined,
      maxAzs,
      natGateways,
      subnetConfiguration: subentConfig,
      flowLogs: {
        FlowLogsToCWL: {
          destination: FlowLogDestination.toCloudWatchLogs(logGrp),
          trafficType: FlowLogTrafficType.ALL,
        },
      },
    });

    if (vpcEndpoints) {
      // SG used by all Interface VPC Endpoints
      this.endpointSecurityGroup = new SecurityGroup(this, 'EndpointSg', {
        vpc: this.vpc,
        description: 'Security group for Interface VPC Endpoints',
        allowAllOutbound: true,
      });
      this.endpointSecurityGroup.addIngressRule(
        Peer.ipv4(this.vpc.vpcCidrBlock),
        Port.tcp(443),
        'Allow VPC internal HTTPS to interface endpoints',
      );
      vpcEndpoints.forEach((svc, idx) => {
        this.vpc.addInterfaceEndpoint(`Endpoint${idx}`, {
          service: svc,
          privateDnsEnabled: true,
          securityGroups: [this.endpointSecurityGroup],
          subnets: { subnets: this.vpc.privateSubnets },
        });
      });
    }
  }
}
