import { KnowledgeCategory } from '@prisma/client';
import { createIntentLogger } from '../utils/logger.js';

const logger = createIntentLogger();

export interface IntentClassification {
  intent: string;
  confidence: number;
  category: KnowledgeCategory | 'OUT_OF_SCOPE';
}

export interface IntentKeywords {
  [key: string]: {
    category: KnowledgeCategory;
    keywords: string[];
    synonyms: string[];
  };
}

// Intent keyword mappings with synonyms
export const INTENT_KEYWORDS: IntentKeywords = {
  ADMIN_KTP: {
    category: KnowledgeCategory.ADMIN_KTP,
    keywords: ['ktp', 'e-ktp', 'kartu tanda penduduk'],
    synonyms: [
      'bikin ktp', 'buat ktp', 'ktp baru', 'syarat ktp', 'prosedur ktp',
      'cara buat ktp', 'mengurus ktp', 'pengurusan ktp', 'daftar ktp'
    ],
  },
  ADMIN_KK: {
    category: KnowledgeCategory.ADMIN_KK,
    keywords: ['kk', 'kartu keluarga'],
    synonyms: [
      'bikin kk', 'buat kk', 'kk baru', 'syarat kk', 'prosedur kk',
      'cara buat kk', 'mengurus kk', 'pengurusan kk', 'tambah anggota kk',
      'ubah data kk', 'perubahan kk', 'update kk'
    ],
  },
  ADMIN_PINDAH: {
    category: KnowledgeCategory.ADMIN_PINDAH,
    keywords: ['surat pindah', 'pindah domisili', 'mutasi'],
    synonyms: [
      'cara pindah', 'prosedur pindah', 'syarat pindah', 'pindah alamat',
      'pindah tempat tinggal', 'surat keterangan pindah', 'domisili baru'
    ],
  },
  ADMIN_AKTA: {
    category: KnowledgeCategory.ADMIN_AKTA,
    keywords: ['akta', 'akta kelahiran', 'akta kematian'],
    synonyms: [
      'surat kelahiran', 'surat kematian', 'akta lahir', 'akta mati',
      'cara buat akta', 'syarat akta', 'prosedur akta', 'pengurusan akta'
    ],
  },
  SOS_BANSOS: {
    category: KnowledgeCategory.SOS_BANSOS,
    keywords: ['bantuan sosial', 'pkh', 'bpnt', 'bansos'],
    synonyms: [
      'program keluarga harapan', 'bantuan pangan', 'bantuan tunai',
      'cara daftar bansos', 'syarat bansos', 'kelayakan bansos',
      'mengajukan bantuan', 'bantuan pemerintah', 'subsidi'
    ],
  },
  POSYANDU: {
    category: KnowledgeCategory.POSYANDU,
    keywords: ['posyandu', 'imunisasi', 'vaksin'],
    synonyms: [
      'jadwal posyandu', 'pemeriksaan balita', 'kesehatan balita',
      'vaksinasi', 'imunisasi anak', 'posyandu balita', 'pelayanan kesehatan',
      'timbang balita', 'cek kesehatan'
    ],
  },
  KEUANGAN_PBB: {
    category: KnowledgeCategory.KEUANGAN_PBB,
    keywords: ['pbb', 'pajak bumi bangunan'],
    synonyms: [
      'bayar pbb', 'tagihan pbb', 'cara bayar pbb', 'cek pbb',
      'pajak rumah', 'pajak tanah', 'pembayaran pbb', 'lunas pbb'
    ],
  },
  KEUANGAN_SAMPAH: {
    category: KnowledgeCategory.KEUANGAN_SAMPAH,
    keywords: ['retribusi sampah', 'sampah', 'kebersihan'],
    synonyms: [
      'bayar sampah', 'tagihan sampah', 'biaya sampah', 'iuran sampah',
      'jadwal sampah', 'pengangkutan sampah', 'pembayaran retribusi'
    ],
  },
  UMUM_JAM: {
    category: KnowledgeCategory.UMUM_JAM,
    keywords: ['jam', 'buka', 'tutup', 'operasional'],
    synonyms: [
      'jam kantor', 'jam buka', 'jam tutup', 'jam kerja', 'jam pelayanan',
      'buka jam berapa', 'tutup jam berapa', 'jadwal kantor', 'waktu pelayanan'
    ],
  },
  UMUM_KONTAK: {
    category: KnowledgeCategory.UMUM_KONTAK,
    keywords: ['kontak', 'telepon', 'nomor', 'hubungi'],
    synonyms: [
      'nomor telepon', 'nomor kantor', 'kontak desa', 'telepon desa',
      'hubungi kantor', 'call center', 'nomor hp', 'whatsapp desa'
    ],
  },
};

// Command patterns
const COMMAND_PATTERNS = {
  HELP: ['/help', '/bantuan', 'help', 'bantuan', 'menu'],
  START: ['/start', '/mulai', 'start', 'mulai', 'halo', 'hai'],
};

export class IntentClassifier {
  private confidenceThreshold = 0.6;

  /**
   * Classify text intent using keyword matching and scoring
   */
  classify(text: string): IntentClassification {
    const normalizedText = this.normalizeText(text);
    
    // Check for commands first
    const command = this.checkCommands(normalizedText);
    if (command) {
      return {
        intent: command,
        confidence: 1.0,
        category: 'OUT_OF_SCOPE',
      };
    }

    // Score each intent
    const scores: Array<{ intent: string; score: number; category: KnowledgeCategory }> = [];
    
    for (const [intentName, intentData] of Object.entries(INTENT_KEYWORDS)) {
      const score = this.calculateIntentScore(normalizedText, intentData);
      if (score > 0) {
        scores.push({
          intent: intentName,
          score,
          category: intentData.category,
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return best match if above threshold
    if (scores.length > 0 && scores[0]!.score >= this.confidenceThreshold) {
      const bestMatch = scores[0]!;
      logger.info({
        text: normalizedText.substring(0, 50),
        intent: bestMatch.intent,
        confidence: bestMatch.score,
        category: bestMatch.category,
      }, 'Intent classified');
      
      return {
        intent: bestMatch.intent,
        confidence: bestMatch.score,
        category: bestMatch.category,
      };
    }

    // Return out of scope
    logger.info({
      text: normalizedText.substring(0, 50),
      bestScore: scores[0]?.score || 0,
      threshold: this.confidenceThreshold,
    }, 'Intent classified as out of scope');
    
    return {
      intent: 'OUT_OF_SCOPE',
      confidence: 0,
      category: 'OUT_OF_SCOPE',
    };
  }

  /**
   * Calculate intent score based on keyword matching
   */
  private calculateIntentScore(
    text: string,
    intentData: { keywords: string[]; synonyms: string[] }
  ): number {
    let score = 0;
    const words = text.split(/\s+/);
    const totalWords = words.length;

    // Check exact keyword matches (higher weight)
    for (const keyword of intentData.keywords) {
      if (text.includes(keyword)) {
        score += 0.8;
      }
    }

    // Check synonym matches (medium weight)
    for (const synonym of intentData.synonyms) {
      if (text.includes(synonym)) {
        score += 0.6;
      }
    }

    // Check individual word matches (lower weight)
    for (const word of words) {
      for (const keyword of intentData.keywords) {
        if (keyword.includes(word) && word.length > 2) {
          score += 0.3;
        }
      }
      
      for (const synonym of intentData.synonyms) {
        if (synonym.includes(word) && word.length > 2) {
          score += 0.2;
        }
      }
    }

    // Normalize score by text length (prevent long texts from getting unfair advantage)
    const normalizedScore = Math.min(score / Math.max(totalWords * 0.1, 1), 1.0);
    
    return normalizedScore;
  }

  /**
   * Check for command patterns
   */
  private checkCommands(text: string): string | null {
    for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
      for (const pattern of patterns) {
        if (text === pattern || text.startsWith(pattern + ' ')) {
          return command;
        }
      }
    }
    return null;
  }

  /**
   * Normalize text for processing
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Set confidence threshold
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    logger.info({ threshold: this.confidenceThreshold }, 'Confidence threshold updated');
  }

  /**
   * Get current confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  /**
   * Get all available intents
   */
  getAvailableIntents(): string[] {
    return Object.keys(INTENT_KEYWORDS);
  }

  /**
   * Get intent keywords for debugging
   */
  getIntentKeywords(intent: string): { keywords: string[]; synonyms: string[] } | null {
    return INTENT_KEYWORDS[intent] || null;
  }
}

// Export singleton instance
export const intentClassifier = new IntentClassifier();
export default intentClassifier;