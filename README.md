# waney93-aws-reference-architecture
Production-grade AWS reference architecture demonstrating secure, scalable, cloud-native application deployment using CDK, ECS Fargate, Aurora Serverless v2,  and CI/CD best practices.


# Architecture Overview

This repository implements a layered AWS Infrastructure-as-Code architecture using AWS CDK v2.
The design intentionally separates low-level resource constructs, composition logic, and environment orchestration to promote:
- **Reusability**: Core constructs can be easily reused across different stacks and environments.
- **Maintainability**: Clear separation of concerns allows for easier updates and debugging.
- **Scalability**: The architecture can be extended to support additional services and environments without significant refactoring.

## Conceptual Structure

The project is organized into three primary conceptual layers:

**Constructs (Construct Abstractions)**
- lib/constructs/
  - These are thin wrappers around AWS CDK constructs. Examples include constructs for VPCs, ECS Clusters, RDS instances, and CI/CD pipelines. As a result, new ecs.FargateService(...) is wrapped inside an opinionated wrapper new ApplicationServiceConstruct(...)
  - Each construct is designed to be modular and configurable, allowing for easy integration into different stacks.
- Benefits:
  - Centralized configuration defaults (e.g., security groups, logging, monitoring). 
  - Enforced security best practices (ECR repositories with encryption, VPCs with private subnets).
  - Reduced duplication across stacks (e.g., consistent VPC and networking setup).
  - Controlled surface area for infrastructure changes (e.g., updating the ApplicationServiceConstruct to change how all Fargate services are provisioned).

## Builders (Composition Layer)

- lib/builders/
  - This layer  orchestrate multiple constructs into meaningful infrastructure components. For example, a network builder might create a VPC, subnets, and security groups together, while an application builder might set up an ECS cluster, task definitions, and services in one cohesive unit.
  - These builders orchestrate the deployment of resources in a specific order and manage dependencies between them.

## Stacks (Environment Orchestrators)

- lib/stacks/
  - This layer defines the actual CDK stacks that will be deployed to AWS. Stacks orchestrate the builders.
  - Stacks are responsible for:
    - Instantiating builders
    - Wiring environment configuration (e.g., dev, staging, prod)
    - Defining deployment boundaries (e.g., which resources go into which stacks)

## Directory Responsibilities

- constructs/
    - Low-level infrastructure wrappers around AWS CDK resources.
    - Examples: VPCConstruct, ApplicationServiceConstruct, PipelineConstruct.
- builders/
    - Higher-level composition logic that assembles constructs into infrastructure domains.
    - Examples: NetworkBuilder, ApplicationBuilder, CICDBuilder.
- interfaces/
    - Shared contracts for configuration and dependency injection.
    - Examples: IApplicationConfig, INetworkConfig.
- stacks/
    - CloudFormation deployment boundaries that orchestrate builders.
    - Examples: SharedServicesStack, InfrastructureStack,CICDStack.
- stages/
    - Environment-specific entry points that instantiate stacks with appropriate configurations.
    - Examples: DevStage, StagingStage, ProdStage.



