import {Controller, Logger} from '@nestjs/common';
import {Ctx, EventPattern, Payload} from '@nestjs/microservices';

@Controller()
export class ExampleController {
  private readonly logger = new Logger(ExampleController.name);

  @EventPattern('orders.created')
  handleOrder(@Payload() data: any, @Ctx() context: any) {
    this.logger.log(`🎉 Received orders.created event:`);
    this.logger.log(`📦 Data: ${JSON.stringify(data)}`);
    this.logger.log(`🔧 Context: ${JSON.stringify({
      subject: context?.subject,
      seq: context?.seq,
      streamName: context?.streamName
    })}`);

    // Acknowledge the message
    if (context && typeof context.ack === 'function') {
      context.ack();
      this.logger.log(`✅ Message acknowledged`);
    } else {
      this.logger.warn(`⚠️ No ack function available in context`);
    }
  }
}
