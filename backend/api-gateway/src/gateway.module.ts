import { Module } from "@nestjs/common";
import { GatewayController } from "./controllers/gateway.controller";
import { GatewayService } from "common/services/gateway.service";

@Module({
  providers: [GatewayService],
  controllers: [GatewayController],
})
export class GatewayModule {}
