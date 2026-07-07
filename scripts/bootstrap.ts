import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately on module load
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
