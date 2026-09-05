import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseTemplateManager } from '../../src/wa/templates.js';

describe('ResponseTemplateManager', () => {
  let templateManager: ResponseTemplateManager;

  beforeEach(() => {
    templateManager = new ResponseTemplateManager();
    // Setup default variable resolvers for tests
    templateManager.setVariableResolver('PHONE', async () => '+6281234567890');
    templateManager.setVariableResolver('OFFICE_HOURS', async () => 'Senin-Jumat 08:00-16:00');
    templateManager.setVariableResolver('OFFICE_PHONE', async () => '+6281234567890');
    templateManager.setVariableResolver('POSYANDU_SCHEDULE', async () => 'Setiap Rabu minggu ke-2');
    templateManager.setVariableResolver('RETRIBUSI_SCHEDULE', async () => 'Setiap hari Senin');
  });

  describe('getResponse', () => {
    it('should return KTP response template', async () => {
      const response = await templateManager.getResponse('ADMIN_KTP');
      expect(response).toContain('KTP');
    });

    it('should return KK response template', async () => {
      const response = await templateManager.getResponse('ADMIN_KK');
      expect(response).toContain('KK');
    });

    it('should return social aid response template', async () => {
      const response = await templateManager.getResponse('SOS_BANSOS');
      expect(response).toContain('bantuan sosial');
    });

    it('should return posyandu response template', async () => {
      const response = await templateManager.getResponse('POSYANDU');
      expect(response).toContain('Posyandu');
    });

    it('should return PBB response template', async () => {
      const response = await templateManager.getResponse('KEUANGAN_PBB');
      expect(response).toContain('PBB');
    });

    it('should return office hours response template', async () => {
      const response = await templateManager.getResponse('UMUM_JAM');
      expect(response).toContain('WIB');
      expect(response).toContain('Kantor');
    });

    it('should return contact info response template', async () => {
      const response = await templateManager.getResponse('UMUM_KONTAK');
      expect(response).toContain('kantor desa');
    });

    it('should return out of scope response for unknown intent', async () => {
      const response = await templateManager.getResponse('unknown_intent');
      expect(response).toContain('Maaf');
    });

    it('should return help response', async () => {
      const response = await templateManager.getResponse('HELP');
      expect(response).toContain('membantu');
    });

    it('should return start response', async () => {
      const response = await templateManager.getResponse('START');
      expect(response).toContain('Selamat datang');
    });

    it('should return clarification response', async () => {
      const response = await templateManager.getResponse('CLARIFICATION');
      expect(response).toContain('pertanyaan');
    });
  });

  describe('variable resolution through getResponse', () => {
    it('should resolve variables in UMUM_KONTAK template', async () => {
      templateManager.setVariableResolver('PHONE', async () => '+6281234567890');
      const response = await templateManager.getResponse('UMUM_KONTAK');
      expect(response).toContain('+6281234567890');
    });

    it('should resolve custom variables with context', async () => {
      templateManager.setTemplate('TEST_TEMPLATE', {
        category: 'OUT_OF_SCOPE',
        templates: ['Halo {{user_name}}, selamat datang!'],
      });
      const response = await templateManager.getResponse('TEST_TEMPLATE', { user_name: 'John' });
      expect(response).toBe('Halo John, selamat datang!');
    });

    it('should handle multiple variables', async () => {
      templateManager.setVariableResolver('VILLAGE', async () => 'Sukamaju');
      templateManager.setTemplate('MULTI_VAR_TEMPLATE', {
        category: 'OUT_OF_SCOPE',
        templates: ['Halo {{user_name}} dari {{VILLAGE}}'],
      });
      const response = await templateManager.getResponse('MULTI_VAR_TEMPLATE', { user_name: 'Jane' });
      expect(response).toContain('Jane');
      expect(response).toContain('Sukamaju');
    });
  });

  describe('setTemplate', () => {
    it('should add new template', async () => {
      templateManager.setTemplate('CUSTOM_TEMPLATE', {
        category: 'OUT_OF_SCOPE',
        templates: ['Custom response'],
      });
      const response = await templateManager.getResponse('CUSTOM_TEMPLATE');
      expect(response).toBe('Custom response');
    });

    it('should override existing template', async () => {
      templateManager.setTemplate('ADMIN_KTP', {
        category: 'ADMIN_KTP',
        templates: ['New KTP response'],
      });
      const response = await templateManager.getResponse('ADMIN_KTP');
      expect(response).toBe('New KTP response');
    });
  });

  describe('setVariableResolver', () => {
    it('should set custom variable resolver', async () => {
      templateManager.setVariableResolver('CUSTOM_VAR', async () => 'custom_value');
      templateManager.setTemplate('RESOLVER_TEST', {
        category: 'OUT_OF_SCOPE',
        templates: ['Test {{CUSTOM_VAR}}'],
      });
      const response = await templateManager.getResponse('RESOLVER_TEST');
      expect(response).toBe('Test custom_value');
    });

    it('should override existing resolver', async () => {
      templateManager.setVariableResolver('PHONE', async () => '+6287654321');
      const response = await templateManager.getResponse('UMUM_KONTAK');
      expect(response).toContain('+6287654321');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return available template keys', () => {
      const templates = templateManager.getAvailableTemplates();
      expect(templates).toContain('ADMIN_KTP');
      expect(templates).toContain('ADMIN_KK');
      expect(templates).toContain('HELP');
      expect(templates).toContain('START');
    });

    it('should include custom templates', () => {
      templateManager.setTemplate('CUSTOM_TEST', {
        category: 'OUT_OF_SCOPE',
        templates: ['Custom test template'],
      });
      const templates = templateManager.getAvailableTemplates();
      expect(templates).toContain('CUSTOM_TEST');
    });
  });

  describe('hasTemplate', () => {
    it('should return true for existing templates', () => {
      expect(templateManager.hasTemplate('ADMIN_KTP')).toBe(true);
      expect(templateManager.hasTemplate('HELP')).toBe(true);
    });

    it('should return false for non-existing templates', () => {
      expect(templateManager.hasTemplate('NON_EXISTENT')).toBe(false);
    });
  });

  describe('helper methods', () => {
    it('should return help message', async () => {
      const helpMessage = await templateManager.getHelpMessage();
      expect(helpMessage).toContain('Bot Pelayanan Desa');
      expect(helpMessage).toContain('Administrasi');
    });

    it('should return welcome message', async () => {
      const welcomeMessage = await templateManager.getWelcomeMessage();
      expect(welcomeMessage).toContain('Selamat datang');
      expect(welcomeMessage).toContain('Bot Pelayanan Desa');
    });

    it('should return clarification message', async () => {
      const clarificationMessage = await templateManager.getClarificationMessage();
      expect(clarificationMessage).toContain('pertanyaan');
    });

    it('should return out of scope message', async () => {
      const outOfScopeMessage = await templateManager.getOutOfScopeMessage();
      expect(outOfScopeMessage).toContain('Maaf');
    });
  });

  describe('integration tests', () => {
    it('should work with real-world scenario', async () => {
      // Setup custom resolvers
      templateManager.setVariableResolver('PHONE', async () => '+6281234567890');
      templateManager.setVariableResolver('OFFICE_HOURS', async () => 'Senin-Jumat 08:00-16:00');
      
      const contactResponse = await templateManager.getResponse('UMUM_KONTAK');
      expect(contactResponse).toContain('+6281234567890');
      
      const officeResponse = await templateManager.getResponse('UMUM_JAM');
      expect(officeResponse).toContain('08.00');
    });

    it('should handle template with context variables', async () => {
      templateManager.setTemplate('GREETING_TEMPLATE', {
        category: 'OUT_OF_SCOPE',
        templates: ['Halo {{user_name}}, selamat datang di {{village_name}}!'],
      });
      
      templateManager.setVariableResolver('village_name', async () => 'Desa Sukamaju');
      
      const response = await templateManager.getResponse('GREETING_TEMPLATE', {
        user_name: 'Pak Budi',
      });
      
      expect(response).toContain('Pak Budi');
      expect(response).toContain('Desa Sukamaju');
    });
  });






});