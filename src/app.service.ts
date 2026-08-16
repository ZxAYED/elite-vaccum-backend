import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: 'elite-vacuum-backend',
      status: 'Purai Pankha',
      timestamp: new Date().toISOString(),
    };
  }

  getHello(): string {
    return 'Shera Pankha Uris dhuris';
  }
}
