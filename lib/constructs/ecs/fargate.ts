import { Construct } from 'constructs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { AlbFargateConstructProps } from '../../interfaces/ecs';
import * as ecs from 'aws-cdk-lib/aws-ecs';

export class AlbFargateConstruct extends Construct {
  public readonly albFargate: ApplicationLoadBalancedFargateService;


  /**
   * Creates an Application Load Balanced Fargate Service.
   *
   * @param scope - The construct scope
   * @param id    - The construct ID
   * @param props - Configuration for the ALB + Fargate service
   */
  constructor(scope: Construct, id: string, props: AlbFargateConstructProps) {
    super(scope, id);

    const idPrefix = props.idPrefix ?? '';

    this.albFargate = new ApplicationLoadBalancedFargateService(
      this,
      `${idPrefix}${props.serviceId}`,
      {
        cluster: props.cluster,
        serviceName: props.serviceName,

        // Load balancer
        publicLoadBalancer: props.loadBalancer.public,
        loadBalancerName: props.loadBalancer.name,

        // Debugging
        enableExecuteCommand: true, // restrict via IAM if needed

        // Task
        desiredCount: props.task.count,
        cpu: props.task.cpu,
        memoryLimitMiB: props.task.memoryLimitMiB,

        // Networking
        listenerPort: props.port.listener,
        taskSubnets: props.vpcSubnets,
        securityGroups: [props.serviceSg],

        // TLS
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificate: props.apiDomainCertificate,
        sslPolicy: elbv2.SslPolicy.RECOMMENDED,

        taskImageOptions: {
          family: props.task.family,
          containerName: props.task.containerName,
          image: ecs.ContainerImage.fromEcrRepository(
            props.repo,
            props.task.imageTag,
          ),
          containerPort: props.port.container,
          logDriver: new ecs.AwsLogDriver({
            logGroup: props.logGroup,
            streamPrefix: props.task.logStreamPrefix,
          }),
          environment: props.environment,
          secrets: props.secretsBag,
          command: props.commands,
        },
      },
    );
    this.albFargate.loadBalancer.addListener(`${idPrefix}HttpRedirect`, {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });
  }
}
