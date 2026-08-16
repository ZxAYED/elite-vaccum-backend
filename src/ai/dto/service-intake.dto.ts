import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ServiceIntakeDto {
    @ApiProperty({
        example:
            'My central vacuum works, but suction upstairs is very weak and one retractable hose is not working.',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(4000)
    message!: string;
}