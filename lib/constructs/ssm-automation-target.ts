import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * EventBridge target that starts an SSM Automation execution
 * by targeting the automation-definition ARN.
 */
export class SsmAutomationTarget implements events.IRuleTarget {
  constructor(
    private readonly automationDefinitionArn: string,
    private readonly invokeRole: iam.IRole,
    private readonly parameters: Record<string, string[]>,
  ) {}

  bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
    return {
      arn: this.automationDefinitionArn,
      role: this.invokeRole,
      // SSM StartAutomationExecution expects "Parameters" values as string lists.
      input: events.RuleTargetInput.fromObject(this.parameters),
    };
  }
}
