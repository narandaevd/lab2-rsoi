import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoyaltyService } from "./services/loyalty.service";
import { LoyaltyController } from "./controllers/loyalty.controller";
import { Loyalty } from "./entities/loyalty.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Loyalty])],
  providers: [LoyaltyService],
  controllers: [LoyaltyController],
})
export class LoyaltyModule {}
