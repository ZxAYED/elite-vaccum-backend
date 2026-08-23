import { z } from 'zod';

export const serviceIntakeJsonSchema = {
  type: 'object',
  properties: {
    suggestedService: {
      type: 'string',
      enum: [
        'LOW_SUCTION_FIX',
        'HOSE_OR_ATTACHMENT_ISSUE',
        'MOTOR_OR_POWER_UNIT_ISSUE',
        'INLET_OR_PIPE_ISSUE',
        'GENERAL_INSPECTION',
        'UNKNOWN',
      ],
      description:
        'The most likely service category based on the customer message.',
    },
    symptoms: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Specific symptoms mentioned by the customer.',
    },
    followUpQuestions: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Questions that would help clarify the issue.',
    },
    suggestedEvidence: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Photos or videos that may help the technician.',
    },
  },
  required: [
    'suggestedService',
    'symptoms',
    'followUpQuestions',
    'suggestedEvidence',
  ],
  additionalProperties: false,
} as const;

export const ServiceIntakeSchema = z.object({
  suggestedService: z.enum([
    'LOW_SUCTION_FIX',
    'HOSE_OR_ATTACHMENT_ISSUE',
    'MOTOR_OR_POWER_UNIT_ISSUE',
    'INLET_OR_PIPE_ISSUE',
    'GENERAL_INSPECTION',
    'UNKNOWN',
  ]),
  symptoms: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  suggestedEvidence: z.array(z.string()),
});

export type ServiceIntakeResult = z.infer<typeof ServiceIntakeSchema>;
