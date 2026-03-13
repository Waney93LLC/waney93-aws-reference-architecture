import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ApplicationLoadBalancedTaskImageOptions } from 'aws-cdk-lib/aws-ecs-patterns';

/**
 * Configuration for Aurora cluster credential
 */
export interface ClusterCredential {}

/**
 * Configuration for ECS cluster
 */
export type ECS_CLUSTER_BUILDER = {
  id: string;
  name: string;
};  

/**
 * Configuration for ECS log group
 */
export type ECS_LOG_GROUP_BUILDER = {
  name: string;
  id: string;
  retention: cdk.aws_logs.RetentionDays;
  removalPolicy: cdk.RemovalPolicy;
};

export type FARGATE_SERVICE_BUILDER = {
  apiDomainCertificate: acm.ICertificate;
  serviceId: string;
  serviceName: string;
  loadBalancer: AlbFargateLoadBalancerConfig;
  task: AlbFargateTaskConfig;
  port: AlbFargatePortConfig;
  vpcSubnets: ec2.SubnetSelection;
  appCmds: string[];
  databaseEngine: string;
  otel:{
    expoterOtlpEndpoint: string;
    expoterOtlpProtocol: string;
  }
  allowedHosts:string;
};

export interface AlbFargateLoadBalancerConfig {
  public: boolean;
  name: string;
}

export interface AlbFargateTaskConfig {
  count: number;
  cpu: number;
  memoryLimitMiB: number;
  family: string;
  containerName: string;
  imageTag: string;
  logStreamPrefix: string;
}

export interface AlbFargatePortConfig {
  listener: number;
  container: number;
}



export interface AlbFargateConstructProps {
  /** ECS cluster to deploy into */
  cluster: ecs.ICluster;
  /** ECR repository for the container image */
  repo: ecr.IRepository;
  /** CloudWatch log group */
  logGroup: logs.ILogGroup;
  /** Security group for the Fargate service */
  serviceSg: ec2.ISecurityGroup;
  /** Secrets to inject into the task */
  secretsBag: Record<string, ecs.Secret>;
  /** Commands to run in the task */
  commands: string[];
  /** Unique ID prefix for resource naming */
  idPrefix?: string;
  environment: ApplicationLoadBalancedTaskImageOptions['environment'];

  // --- Service identity ---
  /** Logical ID suffix for the ALB Fargate service resource */
  serviceId: string;
  /** ECS service name */
  serviceName: string;

  // --- Load balancer ---
  loadBalancer: AlbFargateLoadBalancerConfig;

  // --- Task sizing & count ---
  task: AlbFargateTaskConfig;

  // --- Networking ---
  port: AlbFargatePortConfig;
  vpcSubnets: ec2.SubnetSelection;

  // --- TLS ---
  apiDomainCertificate: acm.ICertificate;
}

export interface AdotHealthCheckConfig {
  command: string[];
  intervalSeconds: number;
  timeoutSeconds: number;
  retries: number;
  startPeriodSeconds: number;
}

export interface AdotPortsConfig {
  otlpGrpc: number;
  otlpHttp: number;
  health: number;
}

export interface AdotSidecarConstructProps {
  /** Task definition to attach the sidecar container to */
  taskDefinition: ecs.TaskDefinition;
  /** The main (web) container that depends on ADOT starting first */
  webContainer: ecs.ContainerDefinition;
  /** Shared log group for sidecar log output */
  logGroup: logs.ILogGroup;

  // --- Container identity ---
  containerName: string;
  /** Public ECR image URI, e.g. "public.ecr.aws/aws-observability/aws-otel-collector:latest" */
  image: string;

  // --- Resources ---
  memoryReservationMiB: number;

  // --- Config ---
  awsRegion: string;
  /** Rendered YAML string for the OTEL collector config */
  otelCollectorConfig: string;
  command: string[];
  logStreamPrefix: string;

  // --- Ports ---
  ports: AdotPortsConfig;

  // --- Health check ---
  healthCheck: AdotHealthCheckConfig;
}

export interface ADOT_SIDECAR_BUILDER {
  // --- Container identity ---
  /** Logical ID suffix used in resource naming, e.g. "AdotSidecar" */
  serviceId: string;
  /** ECS container name, e.g. "adot-collector" */
  containerName: string;
  /**
   * Public ECR image URI.
   * @example "public.ecr.aws/aws-observability/aws-otel-collector:latest"
   */
  image: string;

  // --- Resources ---
  memoryReservationMiB: number;

  // --- OTEL collector config ---
  /**
   * Rendered YAML string passed as the OTEL_COLLECTOR_CONFIG env var.
   * Use a CDK asset or inline string from your config layer.
   */
  otelCollectorConfig: string;
  /** Startup command for the collector process */
  command: string[];

  // --- Logging ---
  /** CloudWatch log stream prefix, e.g. "adot" */
  logStreamPrefix: string;

  // --- Ports ---
  ports: {
    /** gRPC OTLP receiver, typically 4317 */
    otlpGrpc: number;
    /** HTTP OTLP receiver, typically 4318 */
    otlpHttp: number;
    /** Health check endpoint, typically 13133 */
    health: number;
  };

  // --- Health check ---
  healthCheck: {
    /**
     * ECS health check command array.
     * @example ["CMD", "/healthcheck"]
     */
    command: string[];
    /** Seconds between checks, e.g. 5 */
    intervalSeconds: number;
    /** Seconds before a check times out, e.g. 3 */
    timeoutSeconds: number;
    /** Number of consecutive failures before unhealthy, e.g. 2 */
    retries: number;
    /** Grace period after container starts before checks begin, e.g. 10 */
    startPeriodSeconds: number;
  };
}

// --- Builder Interfaces ---

export interface ALB_TO_TASKS_BUILDER {
  /** Container port tasks listen on, e.g. 8000 */
  containerPort: number;
  /** ALB listener port, e.g. 443 */
  listenerPort: number;
  /** Security group rule description, e.g. "Allow ALB to reach Fargate tasks" */
  albToTaskRuleDesc: string;
}

export interface HEALTH_CHECK_BUILDER {
  /** Health check path, e.g. "/health/" */
  path: string;
  /** Comma-separated healthy HTTP codes, e.g. "200" or "200-299" */
  healthyHttpCodes: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThresholdCount: number;
  unhealthyThresholdCount: number;
}

export interface ALERTS_BUILDER {
  /** CDK logical ID suffix for the SNS topic, e.g. "AlertsTopic" */
  topicId: string;
  /** SNS topic display name */
  displayName: string;
  /** Email addresses to subscribe to the topic */
  emailSubscriptions: string[];
  /** CDK logical ID suffix for the EventBridge rule, e.g. "TaskStoppedRule" */
  taskStoppedRuleId: string;
  /**
   * ECS stop codes that trigger the alert.
   * @example ["TaskFailedToStart", "EssentialContainerExited"]
   */
  taskStoppedStopCodes: string[];
}

export interface EcsBuilderProps {


}

export type ServiceSecretsBag = Record<string, ecs.Secret>;
export interface EcsServiceSecretsConfig {
  /**
   * Mutable bag of secrets that can be created/modified outside the builder.
   * addService() will read from here.
   */
  secretsBag?: ServiceSecretsBag;

  /**
   * Optional: which secret keys must exist before addService() can proceed.
   * Keeps addService() honest without coupling it to Secrets Manager resources.
   */
  requiredKeys?: readonly string[];
}
