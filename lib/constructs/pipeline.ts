import { PipelineConstructProps } from '../interfaces/pipeline';
import {
  CodePipeline,
  CodePipelineSource,
  CodeBuildStep,
} from 'aws-cdk-lib/pipelines';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';

/**
 * PipelineConstruct is a reusable construct that defines a CI/CD pipeline using AWS CDK Pipelines.
 */
export class PipelineConstruct extends Construct {
  public readonly pipeline: CodePipeline;

  /**
   * Creates a pipeline construct with the given properties.
   * @param scope - The construct scope
   * @param id - The construct ID
   * @param props - The construct properties
   */
  constructor(scope: Construct, id: string, props: PipelineConstructProps) {
    super(scope, id);

    const source = CodePipelineSource.connection(
      `${props.repoOwner}/${props.repoName}`,
      props.branch ?? 'main',
      {
        connectionArn: props.codestarConnectionArn,
      },
    );

    const defaultSynthPolicies: PolicyStatement[] = [
      new PolicyStatement({
        actions: [
          'ec2:DescribeVpcs',
          'ec2:DescribeSubnets',
          'ec2:DescribeRouteTables',
          'ec2:DescribeSecurityGroups',
          'ec2:DescribeInternetGateways',
          'ec2:DescribeNatGateways',
          'ec2:DescribeVpcPeeringConnections',
          'ec2:DescribeVpnGateways',
          'ec2:DescribeAvailabilityZones',
        ],
        resources: ['*'],
      }),
      new PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/cdk-*`,
        ],
      }),
    ];

    const artifactsBucket =
      props.artifactBucket ??
      new s3.Bucket(this, 'ArtifactsBucket', {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

    this.pipeline = new CodePipeline(this, 'CodePipeline', {
      artifactBucket: artifactsBucket,
      pipelineName: props.pipelineName,
      synth: new CodeBuildStep('Synth', {
        input: source,
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        },
        commands: props.synthCommands ,
        primaryOutputDirectory: 'cdk.out',
        rolePolicyStatements: [
          ...defaultSynthPolicies,
          ...(props.synthRolePolicyStatements ?? []),
        ],
      }),
      crossAccountKeys: false,
    });
  }
}
