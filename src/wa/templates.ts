import { KnowledgeCategory } from '@prisma/client';
import { env } from '../config/env.js';

export interface ResponseTemplate {
  category: KnowledgeCategory | 'OUT_OF_SCOPE' | 'HELP' | 'START';
  templates: string[];
  variables?: string[];
}

// Default response templates
export const RESPONSE_TEMPLATES: { [key: string]: ResponseTemplate } = {
  ADMIN_KTP: {
    category: KnowledgeCategory.ADMIN_KTP,
    templates: [
      'Untuk KTP baru, siapkan fotokopi KK & surat pengantar RT/RW, lalu datang ke kantor desa pada jam kerja.',
      'Syarat membuat KTP: fotokopi KK, surat pengantar RT/RW. Datang ke kantor desa saat jam operasional.',
      'Pengurusan KTP memerlukan fotokopi Kartu Keluarga dan surat pengantar dari RT/RW. Silakan datang ke kantor desa.',
    ],
    variables: ['OFFICE_HOURS'],
  },
  ADMIN_KK: {
    category: KnowledgeCategory.ADMIN_KK,
    templates: [
      'Urus KK dengan surat pengantar RT/RW, fotokopi KTP, dan dokumen pendukung (nikah/akta lahir bila perlu).',
      'Syarat KK: surat pengantar RT/RW, fotokopi KTP, plus dokumen tambahan sesuai keperluan (akta nikah/lahir).',
      'Untuk mengurus Kartu Keluarga, bawa surat pengantar RT/RW, fotokopi KTP, dan dokumen pendukung lainnya.',
    ],
    variables: ['OFFICE_HOURS'],
  },
  ADMIN_PINDAH: {
    category: KnowledgeCategory.ADMIN_PINDAH,
    templates: [
      'Surat pindah perlu pengantar RT/RW, fotokopi KK & KTP, serta pas foto 3×4.',
      'Syarat surat pindah domisili: surat pengantar RT/RW, fotokopi KK, fotokopi KTP, dan pas foto 3×4.',
      'Untuk pindah domisili, siapkan surat pengantar RT/RW, fotokopi KK & KTP, plus pas foto 3×4.',
    ],
    variables: ['OFFICE_HOURS'],
  },
  ADMIN_AKTA: {
    category: KnowledgeCategory.ADMIN_AKTA,
    templates: [
      'Akta kelahiran/kematian: bawa dokumen pendukung (KK, KTP, surat keterangan terkait). Proses di kantor desa.',
      'Untuk akta kelahiran/kematian, siapkan KK, KTP, dan surat keterangan dari rumah sakit/bidan. Urus di kantor desa.',
      'Pengurusan akta memerlukan dokumen pendukung seperti KK, KTP, dan surat keterangan terkait. Datang ke kantor desa.',
    ],
    variables: ['OFFICE_HOURS'],
  },
  SOS_BANSOS: {
    category: KnowledgeCategory.SOS_BANSOS,
    templates: [
      'Info bantuan sosial (PKH/BPNT) silakan datang ke kantor desa atau hubungi staf pelayanan sosial.',
      'Untuk bantuan sosial PKH/BPNT, datang ke kantor desa untuk cek kelayakan dan prosedur pengajuan.',
      'Bantuan sosial seperti PKH dan BPNT bisa dikonsultasikan di kantor desa. Petugas akan bantu cek kelayakan Anda.',
    ],
    variables: ['OFFICE_PHONE'],
  },
  POSYANDU: {
    category: KnowledgeCategory.POSYANDU,
    templates: [
      'Jadwal Posyandu tersedia di kantor desa dan papan informasi. Anda juga bisa cek di sini bila jadwal sudah diinput.',
      'Untuk jadwal Posyandu dan imunisasi balita, silakan cek di papan informasi desa atau tanya di kantor.',
      'Jadwal pemeriksaan balita dan imunisasi di Posyandu bisa dilihat di kantor desa atau papan pengumuman.',
    ],
    variables: ['POSYANDU_SCHEDULE'],
  },
  KEUANGAN_PBB: {
    category: KnowledgeCategory.KEUANGAN_PBB,
    templates: [
      'PBB bisa dibayar di kantor desa atau bank yang ditunjuk. Tagihan dapat dicek lewat petugas desa.',
      'Pembayaran PBB tersedia di kantor desa dan bank tertentu. Untuk cek tagihan, hubungi petugas desa.',
      'Pajak Bumi Bangunan bisa dibayar di kantor desa atau bank yang bekerja sama. Tanyakan tagihan ke petugas.',
    ],
    variables: ['OFFICE_PHONE'],
  },
  KEUANGAN_SAMPAH: {
    category: KnowledgeCategory.KEUANGAN_SAMPAH,
    templates: [
      'Retribusi sampah: jadwal & biaya ditetapkan desa. Silakan cek di kantor atau tanya petugas.',
      'Untuk jadwal dan biaya retribusi sampah, informasi lengkap tersedia di kantor desa.',
      'Jadwal pengangkutan dan tarif retribusi sampah bisa ditanyakan langsung ke kantor desa.',
    ],
    variables: ['OFFICE_PHONE', 'RETRIBUSI_SCHEDULE'],
  },
  UMUM_JAM: {
    category: KnowledgeCategory.UMUM_JAM,
    templates: [
      'Kantor desa: Sen–Jum 08.00–16.00 WIB, istirahat 12.00–13.00 WIB.',
      'Jam operasional kantor desa: Senin-Jumat 08.00-16.00 WIB (istirahat 12.00-13.00 WIB).',
      'Pelayanan kantor desa: Senin sampai Jumat, jam 08.00-16.00 WIB. Istirahat siang 12.00-13.00 WIB.',
    ],
    variables: ['OFFICE_HOURS'],
  },
  UMUM_KONTAK: {
    category: KnowledgeCategory.UMUM_KONTAK,
    templates: [
      'Nomor telepon kantor desa: {{PHONE}}.',
      'Kontak kantor desa: {{PHONE}}. Hubungi untuk informasi lebih lanjut.',
      'Untuk informasi lebih lanjut, hubungi kantor desa di nomor {{PHONE}}.',
    ],
    variables: ['PHONE'],
  },
  OUT_OF_SCOPE: {
    category: 'OUT_OF_SCOPE',
    templates: [
      'Maaf, pertanyaan Anda di luar lingkup layanan saya. Silakan hubungi kantor desa untuk info lebih lanjut.',
      'Mohon maaf, saya hanya bisa membantu dengan informasi layanan desa. Untuk pertanyaan lain, hubungi kantor desa.',
      'Maaf, pertanyaan tersebut di luar kemampuan saya. Silakan datang langsung ke kantor desa atau hubungi petugas.',
    ],
    variables: ['OFFICE_PHONE'],
  },
  HELP: {
    category: 'HELP',
    templates: [
      `🏛️ *Bot Pelayanan Desa*\n\nSaya bisa membantu informasi tentang:\n\n📋 *Administrasi:*\n• KTP & E-KTP\n• Kartu Keluarga (KK)\n• Surat Pindah\n• Akta Kelahiran/Kematian\n\n🤝 *Layanan Sosial:*\n• Bantuan Sosial (PKH/BPNT)\n• Jadwal Posyandu\n\n💰 *Keuangan:*\n• PBB\n• Retribusi Sampah\n\n📞 *Informasi Umum:*\n• Jam Operasional\n• Kontak Kantor\n\nKetik pertanyaan Anda atau /help untuk melihat menu ini lagi.`,
    ],
  },
  START: {
    category: 'START',
    templates: [
      `Selamat datang di Bot Pelayanan Desa! 👋\n\nSaya siap membantu Anda dengan informasi layanan desa.\n\nKetik /help untuk melihat daftar layanan yang tersedia, atau langsung tanyakan apa yang Anda butuhkan.`,
    ],
  },
  CLARIFICATION: {
    category: 'OUT_OF_SCOPE',
    templates: [
      'Mohon bisa diperjelas pertanyaan Anda? Saya bisa membantu dengan informasi KTP, KK, surat pindah, akta, bantuan sosial, posyandu, PBB, retribusi sampah, jam kantor, atau kontak desa.',
      'Bisa tolong diperjelas maksud pertanyaan Anda? Ketik /help untuk melihat layanan yang bisa saya bantu.',
      'Maaf, saya kurang memahami pertanyaan Anda. Bisa dijelaskan lebih spesifik? Atau ketik /help untuk melihat menu.',
    ],
  },
};

export class ResponseTemplateManager {
  private templates: { [key: string]: ResponseTemplate };
  private variableResolvers: { [key: string]: () => Promise<string> };

  constructor() {
    this.templates = { ...RESPONSE_TEMPLATES };
    this.variableResolvers = {
      PHONE: async () => env.DESA_PHONE,
      OFFICE_PHONE: async () => env.DESA_PHONE,
      OFFICE_HOURS: async () => 'Sen–Jum 08.00–16.00 WIB, istirahat 12.00–13.00 WIB',
      POSYANDU_SCHEDULE: async () => 'Cek jadwal terbaru di kantor desa',
      RETRIBUSI_SCHEDULE: async () => 'Informasi lengkap tersedia di kantor desa',
    };
  }

  /**
   * Get response for an intent
   */
  async getResponse(
    intent: string,
    context?: { [key: string]: any }
  ): Promise<string> {
    const template = this.templates[intent];
    
    if (!template) {
      return this.templates['OUT_OF_SCOPE']!.templates[0]!;
    }

    // Select random template for variety
    const selectedTemplate = this.selectRandomTemplate(template.templates);
    
    // Resolve variables
    return this.resolveVariables(selectedTemplate, context);
  }

  /**
   * Select random template for variety
   */
  private selectRandomTemplate(templates: string[]): string {
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex]!;
  }

  /**
   * Resolve template variables
   */
  private async resolveVariables(
    template: string,
    context?: { [key: string]: any }
  ): Promise<string> {
    let resolved = template;

    // Replace context variables first
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        const placeholder = `{{${key}}}`;
        resolved = resolved.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    // Replace predefined variables
    for (const [variable, resolver] of Object.entries(this.variableResolvers)) {
      const placeholder = `{{${variable}}}`;
      if (resolved.includes(placeholder)) {
        try {
          const value = await resolver();
          resolved = resolved.replace(new RegExp(placeholder, 'g'), value);
        } catch (error) {
          console.error(`Failed to resolve variable ${variable}:`, error);
          resolved = resolved.replace(new RegExp(placeholder, 'g'), `[${variable}]`);
        }
      }
    }

    return resolved;
  }

  /**
   * Add or update template
   */
  setTemplate(intent: string, template: ResponseTemplate): void {
    this.templates[intent] = template;
  }

  /**
   * Add variable resolver
   */
  setVariableResolver(variable: string, resolver: () => Promise<string>): void {
    this.variableResolvers[variable] = resolver;
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): string[] {
    return Object.keys(this.templates);
  }

  /**
   * Get template by intent
   */
  getTemplate(intent: string): ResponseTemplate | null {
    return this.templates[intent] || null;
  }

  /**
   * Check if intent has template
   */
  hasTemplate(intent: string): boolean {
    return intent in this.templates;
  }

  /**
   * Get help message
   */
  async getHelpMessage(): Promise<string> {
    return this.getResponse('HELP');
  }

  /**
   * Get welcome message
   */
  async getWelcomeMessage(): Promise<string> {
    return this.getResponse('START');
  }

  /**
   * Get clarification message
   */
  async getClarificationMessage(): Promise<string> {
    return this.getResponse('CLARIFICATION');
  }

  /**
   * Get out of scope message
   */
  async getOutOfScopeMessage(): Promise<string> {
    return this.getResponse('OUT_OF_SCOPE');
  }
}

// Export singleton instance
export const responseTemplateManager = new ResponseTemplateManager();
export default responseTemplateManager;