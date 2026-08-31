import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFaqDto, UpdateFaqDto } from './dto/create-faq.dto';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/create-policy.dto';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultsSeeded();
  }


  // BUSINESS PROFILE & CONTACT


  async getBusinessProfile() {
    let profile = await this.prisma.businessProfile.findFirst();

    if (!profile) {
      profile = await this.prisma.businessProfile.create({
        data: {
          businessName: 'Elite Central Vacuum',
          supportEmail: 'zzayediqbalofficial@gmail.com',
          primaryPhone: '01902320296',
          secondaryPhone: '',
          address: '123 Elite Plaza, Wellness Drive',
          city: 'Greenwich',
          state: 'CT',
          zipCode: '06830',
          country: 'United States',
          coverageMessage: 'Service coverage available by request.',
          coverageNotes:
            'Coverage is reviewed against technician availability, property location, and service type before scheduling is confirmed.',
          operatingHours: {
            monday: '8:00 AM - 8:00 PM',
            tuesday: '8:00 AM - 8:00 PM',
            wednesday: '8:00 AM - 6:00 PM',
            thursday: '8:00 AM - 6:00 PM',
            friday: '8:00 AM - 6:00 PM',
            saturday: '9:00 AM - 3:00 PM',
            sunday: 'Closed',
          },
          socialLinks: {
            facebook: 'https://facebook.com',
            instagram: 'https://instagram.com',
            linkedin: 'https://linkedin.com',
          },
        },
      });
    }

    return {
      success: true,
      data: profile,
    };
  }

  async updateBusinessProfile(dto: UpdateBusinessProfileDto) {
    const existing = await this.prisma.businessProfile.findFirst();

    const data = {
      ...(dto.businessName ? { businessName: dto.businessName.trim() } : {}),
      ...(dto.supportEmail ? { supportEmail: dto.supportEmail.trim().toLowerCase() } : {}),
      ...(dto.primaryPhone ? { primaryPhone: dto.primaryPhone.trim() } : {}),
      ...(dto.secondaryPhone !== undefined ? { secondaryPhone: dto.secondaryPhone?.trim() || null } : {}),
      ...(dto.address ? { address: dto.address.trim() } : {}),
      ...(dto.city ? { city: dto.city.trim() } : {}),
      ...(dto.state ? { state: dto.state.trim() } : {}),
      ...(dto.zipCode ? { zipCode: dto.zipCode.trim() } : {}),
      ...(dto.country ? { country: dto.country.trim() } : {}),
      ...(dto.coverageMessage !== undefined ? { coverageMessage: dto.coverageMessage?.trim() || null } : {}),
      ...(dto.coverageNotes !== undefined ? { coverageNotes: dto.coverageNotes?.trim() || null } : {}),
      ...(dto.operatingHours ? { operatingHours: dto.operatingHours } : {}),
      ...(dto.socialLinks ? { socialLinks: dto.socialLinks } : {}),
    };

    const updated = existing
      ? await this.prisma.businessProfile.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.businessProfile.create({
          data: {
            businessName: dto.businessName || 'Elite Central Vacuum',
            supportEmail: dto.supportEmail || 'zzayediqbalofficial@gmail.com',
            primaryPhone: dto.primaryPhone || '01902320296',
            ...data,
          },
        });

    return {
      success: true,
      message: 'Business profile and contact details updated successfully',
      data: updated,
    };
  }


  // FAQS MANAGEMENT


  async getFaqs(category?: string, status?: string) {
    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const faqs = await this.prisma.systemFaq.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const publishedCount = await this.prisma.systemFaq.count({ where: { status: 'Published' } });
    const hiddenCount = await this.prisma.systemFaq.count({ where: { status: 'Draft' } });

    return {
      success: true,
      data: faqs,
      meta: {
        total: faqs.length,
        publishedCount,
        hiddenCount,
      },
    };
  }

  async createFaq(dto: CreateFaqDto) {
    const faq = await this.prisma.systemFaq.create({
      data: {
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        category: dto.category.trim(),
        status: dto.status || 'Published',
        sortOrder: dto.sortOrder || 0,
      },
    });

    return {
      success: true,
      message: 'FAQ item created successfully',
      data: faq,
    };
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    const existing = await this.prisma.systemFaq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');

    const updated = await this.prisma.systemFaq.update({
      where: { id },
      data: {
        ...(dto.question ? { question: dto.question.trim() } : {}),
        ...(dto.answer ? { answer: dto.answer.trim() } : {}),
        ...(dto.category ? { category: dto.category.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    return {
      success: true,
      message: 'FAQ updated successfully',
      data: updated,
    };
  }

  async deleteFaq(id: string) {
    const existing = await this.prisma.systemFaq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');

    await this.prisma.systemFaq.delete({ where: { id } });

    return {
      success: true,
      message: 'FAQ deleted successfully',
    };
  }


  // LEGAL & POLICIES MANAGEMENT


  async getPolicies() {
    const policies = await this.prisma.legalPolicy.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const publishedCount = policies.filter((p) => p.status === 'Published').length;
    const draftCount = policies.filter((p) => p.status === 'Draft').length;

    return {
      success: true,
      data: policies,
      meta: {
        total: policies.length,
        publishedCount,
        draftCount,
      },
    };
  }

  async getPolicyBySlug(slug: string) {
    const policy = await this.prisma.legalPolicy.findUnique({
      where: { slug: slug.toLowerCase().trim() },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return {
      success: true,
      data: policy,
    };
  }

  async createPolicy(dto: CreatePolicyDto) {
    const policy = await this.prisma.legalPolicy.create({
      data: {
        slug: dto.slug.toLowerCase().trim(),
        title: dto.title.trim(),
        content: dto.content.trim(),
        status: dto.status || 'Published',
        lastUpdated: new Date(),
      },
    });

    return {
      success: true,
      message: 'Policy created successfully',
      data: policy,
    };
  }

  async updatePolicy(id: string, dto: UpdatePolicyDto) {
    const existing = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Policy not found');

    const updated = await this.prisma.legalPolicy.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.content ? { content: dto.content.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        lastUpdated: new Date(),
      },
    });

    return {
      success: true,
      message: 'Policy updated successfully',
      data: updated,
    };
  }

  async deletePolicy(id: string) {
    const existing = await this.prisma.legalPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Policy not found');

    await this.prisma.legalPolicy.delete({ where: { id } });

    return {
      success: true,
      message: 'Policy deleted successfully',
    };
  }


  // DEFAULTS SEEDER


  private async ensureDefaultsSeeded() {
    try {
      // Seed default FAQs if empty
      const faqCount = await this.prisma.systemFaq.count();
      if (faqCount === 0) {
        await this.prisma.systemFaq.createMany({
          data: [
            {
              question: 'How often should a central vacuum system be serviced?',
              answer: 'We recommend preventative maintenance every 12 to 18 months to check suction strength, filter cleanliness, and motor carbon brushes.',
              category: 'Maintenance',
              status: 'Published',
              sortOrder: 1,
            },
            {
              question: 'How long does a new central vacuum installation take?',
              answer: 'Most residential installations take 1 to 2 business days depending on square footage, piping routes, and wall valve placements.',
              category: 'Installation',
              status: 'Published',
              sortOrder: 2,
            },
            {
              question: 'What should I do if my central vacuum loses suction?',
              answer: 'Check the canister bag/bucket first, verify all wall inlet seals are tightly closed, and submit a Low Suction Fix service request for camera line inspection.',
              category: 'Repair',
              status: 'Published',
              sortOrder: 3,
            },
          ],
        });
      }

      // Seed default Terms of Service & Privacy Policy if empty
      const policyCount = await this.prisma.legalPolicy.count();
      if (policyCount === 0) {
        await this.prisma.legalPolicy.createMany({
          data: [
            {
              slug: 'terms',
              title: 'Terms of Service',
              content:
                'These Terms of Service govern your use of the Elite Central Vacuum website, store, service-request system, and related services.\n\nAcceptance of Terms\nUsing the Elite Central Vacuum website, purchasing products, or submitting a service request means you agree to these Terms of Service.\n\nServices\nElite provides central vacuum inspection, maintenance, repair, installation, and related product sales.\n\nService Requests\nSubmitting a service request does not automatically guarantee service acceptance until reviewed by dispatch.\n\nQuotations\nService quotations may include labor, parts, materials, taxes, and discounts. A Service Order is created upon customer acceptance.\n\nScheduling\nElite may confirm, adjust, or reschedule appointments based on technician availability.',
              status: 'Published',
            },
            {
              slug: 'privacy',
              title: 'Privacy Policy',
              content:
                'Elite Central Vacuum respects your personal privacy. We collect customer contact and property details strictly for fulfilling store orders and dispatching field technicians.\n\nData Security\nAll customer data is encrypted in transit and at rest. We never sell customer records to third parties.',
              status: 'Published',
            },
          ],
        });
      }
    } catch {
      // Non-blocking
    }
  }
}
