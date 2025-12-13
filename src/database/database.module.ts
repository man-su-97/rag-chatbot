import { Module } from '@nestjs/common';
import { db } from './drizzle-client';

@Module({
  providers: [
    {
      provide: 'DRIZZLE',
      useValue: db,
    },
  ],
  exports: ['DRIZZLE'],
})
export class DatabaseModule {}
