import { Module } from '@nestjs/common';
import { ExpoPushModule } from '../infra/expo-push/expo-push.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [ExpoPushModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
