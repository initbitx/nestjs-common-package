import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class ExampleController {
  private readonly logger = new Logger(ExampleController.name);

  @EventPattern('orders.created')
  handleOrder(@Payload() data: any) {
    this.logger.log(`Received orders.created: ${JSON.stringify(data)}`);
  }

  @EventPattern('users.registered')
  handleUser(@Payload() data: any) {
    this.logger.log(`Received users.registered: ${JSON.stringify(data)}`);
  }
}
