const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MASAS API',
      version: '1.0.0',
      description:
        'Medicine Availability & Shortage Alert System — REST API for pharmacy inventory management and public medicine search.',
      contact: {
        name: 'MASAS Team',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your access token (obtained via /auth/login or /auth/register)',
        },
      },
      schemas: {
        // ─── Common ─────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              nullable: true,
            },
          },
        },

        // ─── Auth ───────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'pharmacy@example.com' },
            password: { type: 'string', minLength: 8, example: 'SecurePass123' },
            role: { type: 'string', enum: ['PHARMACY', 'ADMIN'], default: 'PHARMACY' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'pharmacy@example.com' },
            password: { type: 'string', example: 'SecurePass123' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['PHARMACY', 'ADMIN'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ─── Pharmacy ───────────────────────────────────
        CreatePharmacyRequest: {
          type: 'object',
          required: ['name', 'licenseNumber', 'address', 'phone', 'latitude', 'longitude'],
          properties: {
            name: { type: 'string', example: 'MedPlus Pharmacy' },
            licenseNumber: { type: 'string', example: 'PH-DL-2024-001' },
            address: { type: 'string', example: '123 Main Street, New Delhi 110001' },
            phone: { type: 'string', example: '+91-9876543210' },
            latitude: { type: 'number', minimum: -90, maximum: 90, example: 28.6139 },
            longitude: { type: 'number', minimum: -180, maximum: 180, example: 77.209 },
          },
        },
        Pharmacy: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            licenseNumber: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            status: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ─── Inventory ──────────────────────────────────
        AddInventoryRequest: {
          type: 'object',
          required: ['medicineName', 'price', 'quantity'],
          properties: {
            medicineName: { type: 'string', example: 'Paracetamol 500mg' },
            genericName: { type: 'string', example: 'Acetaminophen' },
            manufacturer: { type: 'string', example: 'Cipla' },
            category: { type: 'string', example: 'Analgesic' },
            dosageForm: { type: 'string', example: 'Tablet' },
            price: { type: 'number', minimum: 0, example: 25.5 },
            quantity: { type: 'integer', minimum: 0, example: 100 },
            expiryDate: { type: 'string', format: 'date-time', nullable: true },
            isAvailable: { type: 'boolean', default: true },
          },
        },
        UpdateInventoryRequest: {
          type: 'object',
          properties: {
            price: { type: 'number', minimum: 0 },
            quantity: { type: 'integer', minimum: 0 },
            expiryDate: { type: 'string', format: 'date-time', nullable: true },
            isAvailable: { type: 'boolean' },
          },
        },

        // ─── Admin ──────────────────────────────────────
        UpdatePharmacyStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
            rejectionReason: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
  },
  apis: ['./src/modules/*/*.routes.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
