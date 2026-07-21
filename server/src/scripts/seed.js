// Optional seed script: creates a demo owner account and a handful of sample
// boutique items *belonging to that account* so you can explore the app
// immediately. Each account has its own separate inventory.
//
// Run with:  npm run seed
import { initDatabase } from '../config/database.js';
import { UserModel } from '../models/userModel.js';
import { ItemModel } from '../models/itemModel.js';

const DEMO_USER = {
  email: 'owner@example.com',
  password: 'password123',
  name: 'Demo Owner',
  role: 'owner',
};

const SAMPLE_ITEMS = [
  { barcode: '0001112223334', name: 'Silk Scarf', price: 45.0, quantity: 12, low_stock_at: 5, sku: 'ACC-SCF-01', category: 'Accessories' },
  { barcode: '0001112223335', name: 'Leather Handbag', price: 189.99, quantity: 3, low_stock_at: 4, sku: 'BAG-LTH-02', category: 'Bags' },
  { barcode: '0001112223336', name: 'Cotton T-Shirt', price: 24.5, quantity: 0, low_stock_at: 6, sku: 'APP-TSH-03', category: 'Apparel' },
  { barcode: '0001112223337', name: 'Wool Beanie', price: 19.99, quantity: 25, low_stock_at: 8, sku: 'ACC-BNE-04', category: 'Accessories' },
  { barcode: '0001112223338', name: 'Denim Jacket', price: 89.0, quantity: 2, low_stock_at: 3, sku: 'APP-JKT-05', category: 'Apparel' },
  { barcode: '0001112223342', name: 'Leather Loafers', price: 120.0, quantity: 6, low_stock_at: 3, sku: 'SHO-LFR-09', category: 'Shoes' },
  { barcode: '0001112223343', name: 'Running Sneakers', price: 95.0, quantity: 10, low_stock_at: 4, sku: 'SHO-SNK-10', category: 'Shoes' },
];

async function run() {
  await initDatabase();

  let user = await UserModel.findByEmail(DEMO_USER.email);
  if (!user) {
    user = await UserModel.create(DEMO_USER);
    console.log(`✓ Created demo owner: ${DEMO_USER.email} / ${DEMO_USER.password}`);
  } else {
    console.log('• Demo owner already exists, skipping account creation.');
  }

  for (const item of SAMPLE_ITEMS) {
    if (!(await ItemModel.findByBarcode(user.id, item.barcode))) {
      await ItemModel.create(user.id, item);
      console.log(`✓ Added item: ${item.name}`);
    }
  }

  console.log(
    '\nSeed complete. Default owner PIN is whatever DEFAULT_OWNER_PIN is set to (123456 by default).'
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
