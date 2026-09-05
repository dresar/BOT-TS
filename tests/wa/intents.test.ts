import { describe, it, expect, beforeEach } from 'vitest';
import { IntentClassifier } from '../../src/wa/intents.js';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = new IntentClassifier();
  });

  describe('classify', () => {
    it('should classify KTP related messages', () => {
      const testCases = [
        'Bagaimana cara membuat KTP?',
        'Syarat bikin kartu tanda penduduk',
        'KTP saya hilang, gimana ya?',
        'Perpanjang KTP dimana?',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('ktp');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should classify KK related messages', () => {
      const testCases = [
        'Cara buat kartu keluarga baru',
        'KK hilang, bagaimana mengurus?',
        'Syarat membuat KK',
        'Perpanjang kartu keluarga',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('kk');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should classify social aid related messages', () => {
      const testCases = [
        'Bantuan sosial untuk warga',
        'PKH kapan cair?',
        'Bansos bulan ini',
        'Cara daftar bantuan pemerintah',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('social_aid');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should classify Posyandu related messages', () => {
      const testCases = [
        'Jadwal posyandu bulan ini',
        'Kapan ada posyandu?',
        'Imunisasi anak dimana?',
        'Cek kesehatan balita',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('posyandu');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should classify PBB related messages', () => {
      const testCases = [
        'Bayar PBB dimana?',
        'Pajak bumi dan bangunan',
        'SPPT PBB hilang',
        'Cara bayar pajak rumah',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('pbb');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should classify office hours related messages', () => {
      const testCases = [
        'Jam buka kantor desa',
        'Kantor tutup jam berapa?',
        'Jadwal pelayanan',
        'Jam operasional',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('office_hours');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should classify contact info related messages', () => {
      const testCases = [
        'Nomor telepon kantor desa',
        'Alamat kantor',
        'Kontak kepala desa',
        'Email desa',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('contact_info');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should return unknown intent for unrecognized messages', () => {
      const testCases = [
        'Hello world',
        'Random text here',
        'xyz abc 123',
        'Completely unrelated message',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('unknown');
        expect(result.confidence).toBe(0);
      });
    });

    it('should handle empty or whitespace messages', () => {
      const testCases = ['', '   ', '\n\t', '\r\n'];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('unknown');
        expect(result.confidence).toBe(0);
      });
    });

    it('should be case insensitive', () => {
      const testCases = [
        'KTP',
        'ktp',
        'Ktp',
        'KARTU TANDA PENDUDUK',
        'kartu tanda penduduk',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('ktp');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should handle messages with multiple intents and return highest confidence', () => {
      // Message that could match multiple intents
      const message = 'Saya mau buat KTP dan juga tanya jadwal posyandu';
      const result = classifier.classify(message);
      
      // Should return one of the intents with confidence > 0
      expect(['ktp', 'posyandu']).toContain(result.intent);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should normalize text properly', () => {
      const message = '  BAGAIMANA   cara   MEMBUAT   ktp???  ';
      const result = classifier.classify(message);
      
      expect(result.intent).toBe('ktp');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle special characters and punctuation', () => {
      const message = 'KTP!!! @#$% gimana caranya???';
      const result = classifier.classify(message);
      
      expect(result.intent).toBe('ktp');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return higher confidence for exact keyword matches', () => {
      const exactMatch = classifier.classify('KTP');
      const partialMatch = classifier.classify('Saya ingin tahu tentang KTP');
      
      expect(exactMatch.intent).toBe('ktp');
      expect(partialMatch.intent).toBe('ktp');
      expect(exactMatch.confidence).toBeGreaterThanOrEqual(partialMatch.confidence);
    });

    it('should handle Indonesian language variations', () => {
      const testCases = [
        'gimana cara bikin KTP?',
        'bagaimana membuat KTP?',
        'cara buat KTP',
        'mau bikin kartu tanda penduduk',
      ];

      testCases.forEach(message => {
        const result = classifier.classify(message);
        expect(result.intent).toBe('ktp');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('getIntentKeywords', () => {
    it('should return keywords for valid intent', () => {
      const ktpKeywords = classifier.getIntentKeywords('ktp');
      expect(ktpKeywords).toContain('ktp');
      expect(ktpKeywords).toContain('kartu tanda penduduk');
    });

    it('should return empty array for invalid intent', () => {
      const keywords = classifier.getIntentKeywords('invalid_intent');
      expect(keywords).toEqual([]);
    });
  });

  describe('getAllIntents', () => {
    it('should return all available intents', () => {
      const intents = classifier.getAllIntents();
      const expectedIntents = [
        'ktp',
        'kk',
        'social_aid',
        'posyandu',
        'pbb',
        'office_hours',
        'contact_info',
        'general_info',
      ];

      expectedIntents.forEach(intent => {
        expect(intents).toContain(intent);
      });
    });
  });
});