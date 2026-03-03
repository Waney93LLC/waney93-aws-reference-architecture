import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import { EventRouterProps } from '../interfaces/shared-services';

/**
 * EventRouter
 *
 * Purpose:
 *   A construct that sets up EventBridge rules based on provided configuration.
 *   This is a simple example; you can expand it with more features as needed.
 */
export class EventRouter extends Construct {
  public readonly rules: events.Rule[] = [];
  /**
   * Creates an EventRouter construct.
   * @param scope The parent construct.
   * @param id The construct ID.
   * @param props The properties for the EventRouter.
   */
  constructor(scope: Construct, id: string, props: EventRouterProps) {
    super(scope, id);

    for (const route of props.routes) {
      const rule = new events.Rule(this, route.name, {
        eventBus: route.eventBus,
        eventPattern: route.eventPattern,
        enabled: route.enabled ?? true,
      });

      for (const t of route.targets) {
        // If you want one shared input for all targets:
        // rule.addTarget(t, { input: route.input });
        // But CDK targets don't all accept options the same way.
        rule.addTarget(t);
      }

      this.rules.push(rule);
    }
  }
}
