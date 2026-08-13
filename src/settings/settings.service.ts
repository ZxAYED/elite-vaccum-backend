// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { SettingsType } from '@prisma/client';
// import { UpdateSettingDto } from './dto/update-setting.dto';

// @Injectable()
// export class SettingsService {
//   constructor(private readonly prisma: PrismaService) {}

//   async findByType(type: SettingsType) {
//     const setting = await this.prisma.settingsContent.findUnique({
//       where: { type },
//     });
//     // Return empty if not found, or throw? UI expects text.
//     return setting || { type, content: '', updatedAt: new Date() };
//   }

//   async update(type: SettingsType, dto: UpdateSettingDto) {
//     return this.prisma.settingsContent.upsert({
//       where: { type },
//       create: { type, content: dto.content },
//       update: { content: dto.content },
//     });
//   }
// }
