// import {
//   Controller,
//   Get,
//   Body,
//   Patch,
//   Query,
//   BadRequestException,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
// import { SettingsService } from './settings.service';
// import { UpdateSettingDto } from './dto/update-setting.dto';
// import { Roles } from '../common/decorator/rolesDecorator';
// import { SettingsType } from '@prisma/client';

// @ApiTags('Settings')
// @Roles('ADMIN')
// @Controller('settings')
// export class SettingsController {
//   constructor(private readonly settingsService: SettingsService) {}

//   @Get()
//   @ApiOperation({ summary: 'Get settings content by type' })
//   @ApiQuery({ name: 'type', enum: SettingsType })
//   findByType(@Query('type') type: SettingsType) {
//     if (!type) throw new BadRequestException('Type is required');
//     return this.settingsService.findByType(type);
//   }

//   @Patch()
//   @ApiOperation({ summary: 'Update settings content by type' })
//   @ApiQuery({ name: 'type', enum: SettingsType })
//   update(@Query('type') type: SettingsType, @Body() dto: UpdateSettingDto) {
//     if (!type) throw new BadRequestException('Type is required');
//     return this.settingsService.update(type, dto);
//   }
// }
