import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: 'aryegrunzwieg-backend',
      status: 'Purai Pankha',
      timestamp: new Date().toISOString(),
    };
  }

  getHello(): string {
    return 'aryegrunzwieg-backend API is running';
  }
}
