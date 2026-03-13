import { Construct } from 'constructs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { AlbFargateConstructProps } from '../../interfaces/ecs';

export class AlbFargateConstruct extends Construct {
  public readonly service: ApplicationLoadBalancedFargateService;
  public readonly taskDefinition: ApplicationLoadBalancedFargateService['taskDefinition'];

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

    this.service = new ApplicationLoadBalancedFargateService(
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

        // taskImageOptions: {
        //   family: ECS_CONFIG.SERVICE.TASK_DEFINITION_FAMILY,
        //   containerName: ECS_CONFIG.SERVICE.WEB_CONTAINER_NAME,
        //   image: ecs.ContainerImage.fromEcrRepository(props.repo, imageTag),
        //   containerPort: ECS_CONFIG.SERVICE.CONTAINER_PORT,
        //   logDriver: new ecs.AwsLogDriver({
        //     logGroup: props.logGroup,
        //     streamPrefix: ECS_CONFIG.LOGS.STREAM_PREFIX_WEB,
        //   }),
        //   environment: { ... },
        //   secrets: props.secretsBag,
        //   command: ECS_CONFIG.GUNICORN.COMMAND,
        // },
      },
    );
    this.taskDefinition = this.service.taskDefinition;

    // HTTP → HTTPS redirect listener (uncomment when ready)
    // this.service.loadBalancer.addListener(`${idPrefix}HttpRedirect`, {
    //   port: 80,
    //   protocol: elbv2.ApplicationProtocol.HTTP,
    //   defaultAction: elbv2.ListenerAction.redirect({
    //     protocol: 'HTTPS',
    //     port: '443',
    //     permanent: true,
    //   }),
    // });
  }
}
