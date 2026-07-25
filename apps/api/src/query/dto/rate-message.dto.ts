import { IsIn } from 'class-validator';

export class RateMessageDto {
  @IsIn(['up', 'down'])
  rating!: 'up' | 'down';
}
