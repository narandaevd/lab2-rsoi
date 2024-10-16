import { Module } from "@nestjs/common";
import { GatewayController } from "./controllers/gateway.controller";
import { GatewayService } from "common/services/gateway.service";
import { HealthController } from "controllers/health.controller";

@Module({
  providers: [GatewayService],
  controllers: [GatewayController, HealthController],
})
export class GatewayModule {}
