import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { Dispute } from '../entities/dispute.entity';
import { DisputeEvidence } from '../entities/dispute-evidence.entity';
import { Split } from '../entities/split.entity';
import { DisputeNotificationListener } from './listeners/dispute-notification.listener';
import { DisputeAuditListener } from './listeners/dispute-audit.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, DisputeEvidence, Split]),
    EventEmitterModule,
  ],
  controllers: [DisputesController],
  providers: [
    DisputesService,
    DisputeNotificationListener,
    DisputeAuditListener,
  ],
  exports: [DisputesService],
})
export class DisputesModule {}
