import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupSwagger = (app) => {
  const swaggerFilePath = path.join(__dirname, 'swagger-output.json');

  if (fs.existsSync(swaggerFilePath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerFilePath, 'utf8'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    }));
    console.log('Swagger UI initialized at /api-docs');
  } else {
    console.warn('Swagger output file not found. Run "npm run swagger" to generate it.');
  }
};