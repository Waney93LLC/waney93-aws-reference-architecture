import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { AdotSidecarConstructProps } from '../../interfaces/ecs';


export class AdotSidecarConstruct extends Construct {
  public readonly container: ecs.ContainerDefinition;

  /**
   * Adds an AWS Distro for OpenTelemetry (ADOT) sidecar container to an
   * existing ECS task definition and wires it up as a dependency of the
   * main web container.
   *
   * @param scope - The construct scope
   * @param id    - The construct ID
   * @param props - Configuration for the ADOT sidecar
   */
  constructor(scope: Construct, id: string, props: AdotSidecarConstructProps) {
    super(scope, id);

    this.container = props.taskDefinition.addContainer(id, {
      containerName: props.containerName,
      image: ecs.ContainerImage.fromRegistry(props.image),
      essential: false,
      memoryReservationMiB: props.memoryReservationMiB,

      logging: new ecs.AwsLogDriver({
        logGroup: props.logGroup,
        streamPrefix: props.logStreamPrefix,
      }),

      environment: {
        AWS_REGION: props.awsRegion,
        OTEL_COLLECTOR_CONFIG: props.otelCollectorConfig,
      },

      command: props.command,

      healthCheck: {
        command: props.healthCheck.command,
        interval: cdk.Duration.seconds(props.healthCheck.intervalSeconds),
        timeout: cdk.Duration.seconds(props.healthCheck.timeoutSeconds),
        retries: props.healthCheck.retries,
        startPeriod: cdk.Duration.seconds(props.healthCheck.startPeriodSeconds),
      },
    });

    this.container.addPortMappings(
      { containerPort: props.ports.otlpGrpc, protocol: ecs.Protocol.TCP },
      { containerPort: props.ports.otlpHttp, protocol: ecs.Protocol.TCP },
      { containerPort: props.ports.health, protocol: ecs.Protocol.TCP },
    );

    // Web container waits for ADOT to start before initialising
    props.webContainer.addContainerDependencies({
      container: this.container,
      condition: ecs.ContainerDependencyCondition.START,
    });
  }
}
