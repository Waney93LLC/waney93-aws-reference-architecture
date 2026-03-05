
import {InterfaceVpcEndpointAwsService} from "aws-cdk-lib/aws-ec2";
import { LogGroup } from 'aws-cdk-lib/aws-logs';

/**
 * Encapsulates the properties for the Network Construct, which includes VPC and related resources.
 * This interface defines the configurable options for the Network Construct, allowing for
 * customization of the VPC, subnets, and other network-related settings.
 * 
 */
export interface NetworkProps {
  maxAzs?: number; // default 2
  natGateways?: number; // default 1 (prod: 2)
  vpcCidr?: string; // optional CIDR
  logGrp: LogGroup;
  vpcEndpoints?: InterfaceVpcEndpointAwsService[];
  cidrMaskPublic?: number; 
  cidrMaskPrivate: number;
  idPrefix: string;
}